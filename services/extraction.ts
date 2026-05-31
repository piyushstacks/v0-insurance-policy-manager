/**
 * Enhanced Extraction Service V2
 * Features:
 * - Intelligent customer name deduplication (handles: DINESH RAMCHAND, dinesh ramchand, dineshetc, etc)
 * - Cross-verification using policy content (age, mobile, email, full name)
 * - Robust bulk extraction with parallel processing and retry logic
 * - Comprehensive error handling and logging
 * - Smart entity matching and fuzzy deduplication
 */

import { supabaseAdmin } from '@/lib/supabase';
import { ocrProvider } from './ocr-provider';
import redis, { enqueueExtractionJob, getNextJob, completeJob, failJob } from '@/lib/redis';
import { ExtractionResultInput } from '@/lib/schemas';
import pLimit from 'p-limit';

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

const NAME_SIMILARITY_THRESHOLD = 0.75; // 75% match = same person
const CONTACT_MATCH_CONFIDENCE = 0.95; // High confidence for email/mobile match
const BATCH_PROCESSING_LIMIT = 5; // Process 5 jobs in parallel
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2000;

interface CustomerDedupeResult {
  customerId: string;
  customerName: string;
  email?: string | null;
  mobile?: string | null;
  matchScore: number;
  matchType: 'exact' | 'fuzzy' | 'contact' | 'cross_verified';
  crossVerified: boolean;
  verificationDetails?: {
    name_similarity: number;
    contact_match: boolean;
    contact_type?: 'email' | 'mobile';
    details: string[];
  };
}

/**
 * Check if a string contains masked characters (like xxxx)
 */
function isMasked(value: string | null | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower.includes('xxxx') || lower.includes('****') || /^[x\*]+$/.test(lower);
}

export interface PolicyExtractionMetrics {
  jobId: string;
  success: boolean;
  duration: number;
  customerDeduped: boolean;
  insurerResolved: boolean;
  extractedFields: {
    policy_number: boolean;
    customer_name: boolean;
    insurer_name: boolean;
    premium_amount: boolean;
  };
  error?: string;
}

// ============================================================================
// NAME NORMALIZATION & DEDUPLICATION
// ============================================================================

/**
 * Normalize customer name for matching
 * Handles: case, whitespace, special chars, common variations
 */
export function normalizeCustomerName(name: string): string {
  if (!name) return '';

  return name
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ') // Replace underscores with space
    .replace(/[^a-z0-9\s]/g, '') // Strip all other non-alphanumeric characters (hyphens, apostrophes, non-ASCII)
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/\b(jr|sr|esq|ii|iii|iv|v)\b/g, '') // Remove common suffixes
    .trim();
}

/**
 * Extract first and last name components
 */
export function extractNameComponents(name: string): {
  firstName: string;
  lastName: string;
  initials: string;
  wordCount: number;
} {
  const normalized = normalizeCustomerName(name);
  const parts = normalized.split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] || '',
    lastName: parts[parts.length - 1] || '',
    initials: parts.map(p => p[0]).join('').toUpperCase(),
    wordCount: parts.length,
  };
}

/**
 * Calculate name similarity using Levenshtein distance
 * Returns similarity score 0-1 (1 = identical)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeCustomerName(name1);
  const norm2 = normalizeCustomerName(name2);

  if (norm1 === norm2) return 1;
  if (!norm1 || !norm2) return 0;

  const words1 = norm1.split(/\s+/).filter(Boolean);
  const words2 = norm2.split(/\s+/).filter(Boolean);

  // Check for perfect word permutation match
  const sorted1 = [...words1].sort().join(' ');
  const sorted2 = [...words2].sort().join(' ');
  if (sorted1 === sorted2) {
    return norm1 === norm2 ? 1 : 0.85;
  }

  // Filter out common corporate noise words for company/insurer matching
  const noiseWords = new Set(['company', 'ltd', 'limited', 'insurance', 'corp', 'corporation', 'co', 'general', 'services']);
  const cleanWords1 = words1.filter(w => !noiseWords.has(w));
  const cleanWords2 = words2.filter(w => !noiseWords.has(w));

  const cleanNorm1 = cleanWords1.join(' ');
  const cleanNorm2 = cleanWords2.join(' ');

  if (cleanNorm1 === cleanNorm2 && cleanNorm1.length > 0) return 1;

  // If one clean name is substring of the other clean name, give high similarity
  if (cleanNorm1 && cleanNorm2) {
    if (cleanNorm1.includes(cleanNorm2) || cleanNorm2.includes(cleanNorm1)) {
      const minLen = Math.min(cleanNorm1.length, cleanNorm2.length);
      const maxLen = Math.max(cleanNorm1.length, cleanNorm2.length);
      if (minLen / maxLen >= 0.4) {
        return 0.85;
      }
    }
  }

  // Calculate fuzzy word-level similarity
  let totalWordSimilarity = 0;
  for (const w1 of words1) {
    let bestWordSim = 0;
    for (const w2 of words2) {
      const wordMaxLen = Math.max(w1.length, w2.length);
      const wordDist = levenshteinDistance(w1, w2);
      const wordSim = 1 - wordDist / wordMaxLen;
      if (wordSim > bestWordSim) {
        bestWordSim = wordSim;
      }
    }
    if (bestWordSim >= 0.6) {
      totalWordSimilarity += bestWordSim;
    }
  }
  const fuzzyJaccard = totalWordSimilarity / Math.max(words1.length, words2.length);

  // Calculate Levenshtein similarity of the entire normalized strings
  const maxLen = Math.max(norm1.length, norm2.length);
  const distance = levenshteinDistance(norm1, norm2);
  const levSimilarity = 1 - distance / maxLen;

  let similarity = Math.max(levSimilarity, fuzzyJaccard);

  // If no words match fuzzily for multi-word names, penalize similarity heavily
  if (fuzzyJaccard === 0 && (words1.length > 1 || words2.length > 1)) {
    similarity = similarity * 0.1;
  }

  // Boost score if first and last names match
  const comp1 = extractNameComponents(norm1);
  const comp2 = extractNameComponents(norm2);

  if (comp1.firstName === comp2.firstName && comp1.lastName === comp2.lastName && comp1.firstName !== '') {
    return Math.min(1, similarity + 0.2);
  }

  // Penalize if word count is very different
  if (Math.abs(comp1.wordCount - comp2.wordCount) > 2) {
    return Math.max(0, similarity - 0.1);
  }

  return similarity;
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(s1: string, s2: string): number {
  const track = Array(s2.length + 1)
    .fill(null)
    .map(() => Array(s1.length + 1).fill(0));

  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return track[s2.length][s1.length];
}

/**
 * Check if two contact details match (email or mobile)
 */
function contactsMatch(
  contact1: { email?: string | null; mobile?: string | null },
  contact2: { email?: string | null; mobile?: string | null }
): { matched: boolean; type?: 'email' | 'mobile' } {
  if (
    contact1.email &&
    contact2.email &&
    contact1.email.toLowerCase() === contact2.email.toLowerCase()
  ) {
    return { matched: true, type: 'email' };
  }

  if (
    contact1.mobile &&
    contact2.mobile &&
    normalizePhoneNumber(contact1.mobile) === normalizePhoneNumber(contact2.mobile)
  ) {
    return { matched: true, type: 'mobile' };
  }

  return { matched: false };
}

/**
 * Normalize phone number for comparison
 */
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10); // Last 10 digits
}

/**
 * Cross-verify if two customers are the same person
 * Uses policy content: age, mobile, email, full name
 */
export async function crossVerifyCustomer(
  existingCustomer: {
    id: string;
    name: string;
    email?: string | null;
    mobile?: string | null;
  },
  extractedData: {
    customer_name?: string | null;
    customer_email?: string | null;
    customer_mobile?: string | null;
    customer_age?: number | null;
    full_details?: string;
  }
): Promise<{
  isSamePerson: boolean;
  confidence: number;
  matchDetails: {
    name_similarity: number;
    contact_match: boolean;
    contact_type?: 'email' | 'mobile';
    details: string[];
  };
}> {
  const details: string[] = [];
  const nameSimilarity = calculateNameSimilarity(
    existingCustomer.name,
    extractedData.customer_name || ''
  );
  details.push(`Name similarity: ${(nameSimilarity * 100).toFixed(1)}%`);

  const contactMatch = contactsMatch(
    { email: existingCustomer.email, mobile: existingCustomer.mobile },
    { email: extractedData.customer_email, mobile: extractedData.customer_mobile }
  );

  const emailConflict = (existingCustomer.email && extractedData.customer_email && 
                         existingCustomer.email.toLowerCase() !== extractedData.customer_email.toLowerCase());
  const mobileConflict = (existingCustomer.mobile && extractedData.customer_mobile && 
                          normalizePhoneNumber(existingCustomer.mobile) !== normalizePhoneNumber(extractedData.customer_mobile));
  const contactConflict = emailConflict || mobileConflict;

  let ageMatch = false;
  if (extractedData.customer_age && extractedData.full_details) {
    ageMatch = extractedData.full_details.toLowerCase().includes(extractedData.customer_age.toString());
  }

  let isSamePerson = false;
  if (!contactConflict) {
    if (nameSimilarity >= 0.95) {
      isSamePerson = true;
      details.push('✓ Name matches (fuzzy)');
    } else if (nameSimilarity >= NAME_SIMILARITY_THRESHOLD && ageMatch) {
      isSamePerson = true;
      details.push('✓ Name matches (fuzzy) and age verified');
    } else if (contactMatch.matched && nameSimilarity >= 0.6) {
      isSamePerson = true;
      details.push(`✓ Name matches (decent) and ${contactMatch.type} matches perfectly`);
    }
  }

  // Calculate confidence score (0 to 1)
  let confidence = nameSimilarity * 0.4;
  if (contactMatch.matched) {
    confidence = Math.max(confidence + 0.55, 0.95);
  }
  if (ageMatch) {
    confidence = Math.min(1.0, confidence + 0.1);
  }

  return {
    isSamePerson,
    confidence,
    matchDetails: {
      name_similarity: nameSimilarity,
      contact_match: contactMatch.matched,
      contact_type: contactMatch.type,
      details,
    },
  };
}

/**
 * Find or create customer with intelligent deduplication
 */
export async function findOrCreateCustomer(extractedData: {
  customer_name?: string | null;
  customer_email?: string | null;
  customer_mobile?: string | null;
  customer_age?: number | null;
  full_details?: string;
}): Promise<CustomerDedupeResult | null> {
  if (!extractedData.customer_name) {
    console.log('[Dedup] No customer name extracted, skipping');
    return null;
  }

  try {
    // 1. Fetch all existing customers
    const { data: allCustomers, error: fetchError } = await supabaseAdmin!
      .from('customers')
      .select('id, name, email, mobile');

    if (fetchError) {
      console.error('[Dedup] Failed to fetch customers:', fetchError);
      return null;
    }

    if (!allCustomers || allCustomers.length === 0) {
      console.log('[Dedup] No existing customers, creating new one');
      return createNewCustomer(extractedData);
    }

    // 2. Run fuzzy matching against all customers
    let bestMatch: (typeof allCustomers)[0] & { score: number } | null = null;
    let bestScore = 0;

    for (const customer of allCustomers) {
      const similarity = calculateNameSimilarity(extractedData.customer_name, customer.name);

      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = { ...customer, score: similarity };
      }
    }

    // 3. If fuzzy match found, cross-verify
    if (bestMatch && bestScore >= NAME_SIMILARITY_THRESHOLD) {
      console.log(
        `[Dedup] Found fuzzy match: "${bestMatch.name}" (${(bestScore * 100).toFixed(1)}%)`
      );

      const verification = await crossVerifyCustomer(
        {
          id: bestMatch.id,
          name: bestMatch.name,
          email: bestMatch.email,
          mobile: bestMatch.mobile,
        },
        extractedData
      );

      if (verification.isSamePerson) {
        console.log(
          `[Dedup] ✓ Cross-verified as same person (confidence: ${(verification.confidence * 100).toFixed(1)}%)`
        );
        console.log(
          `[Dedup] Verification details: ${verification.matchDetails.details.join(', ')}`
        );

        // Update customer with new contact info if found
        // Use the returned updated object to enrich extraction
        const updatedCustomer = await updateCustomerContacts(bestMatch.id, extractedData);

        return {
          customerId: bestMatch.id,
          customerName: bestMatch.name,
          email: updatedCustomer?.email || bestMatch.email,
          mobile: updatedCustomer?.mobile || bestMatch.mobile,
          matchScore: verification.confidence,
          matchType: 'cross_verified',
          crossVerified: true,
          verificationDetails: verification.matchDetails,
        };
      }
    }

    // 4. Check for exact contact match (email or mobile)
    for (const customer of allCustomers) {
      const contactMatch = contactsMatch(
        { email: customer.email, mobile: customer.mobile },
        {
          email: extractedData.customer_email,
          mobile: extractedData.customer_mobile,
        }
      );

      if (contactMatch.matched) {
        console.log(
          `[Dedup] Found exact ${contactMatch.type} match for customer "${customer.name}"`
        );
        
        const updatedCustomer = await updateCustomerContacts(customer.id, extractedData);

        return {
          customerId: customer.id,
          customerName: customer.name,
          email: updatedCustomer?.email || customer.email,
          mobile: updatedCustomer?.mobile || customer.mobile,
          matchScore: CONTACT_MATCH_CONFIDENCE,
          matchType: 'contact',
          crossVerified: true,
        };
      }
    }

    // 5. No match found, create new customer
    console.log(
      `[Dedup] No match found (best fuzzy score: ${(bestScore * 100).toFixed(1)}%), creating new customer`
    );
    return createNewCustomer(extractedData);
  } catch (error) {
    console.error('[Dedup] Error during customer deduplication:', error);
    return null;
  }
}

/**
 * Create a new customer
 */
async function createNewCustomer(extractedData: {
  customer_name?: string | null;
  customer_email?: string | null;
  customer_mobile?: string | null;
}): Promise<CustomerDedupeResult | null> {
  try {
    const { data: newCustomer, error } = await supabaseAdmin!
      .from('customers')
      .insert([
        {
          name: extractedData.customer_name,
          email: extractedData.customer_email || null,
          mobile: extractedData.customer_mobile || null,
        },
      ])
      .select('id')
      .single();

    if (error) {
      console.error('[Dedup] Failed to create customer:', error);
      return null;
    }

    console.log(
      `[Dedup] ✓ New customer created: "${extractedData.customer_name}" (ID: ${newCustomer.id})`
    );

    return {
      customerId: newCustomer.id,
      customerName: extractedData.customer_name || '',
      email: extractedData.customer_email || null,
      mobile: extractedData.customer_mobile || null,
      matchScore: 1,
      matchType: 'exact',
      crossVerified: false,
    };
  } catch (error) {
    console.error('[Dedup] Error creating new customer:', error);
    return null;
  }
}

/**
 * Update customer contact information with unmasking logic
 */
async function updateCustomerContacts(
  customerId: string,
  extractedData: {
    customer_email?: string | null;
    customer_mobile?: string | null;
  }
): Promise<{ email?: string | null; mobile?: string | null } | null> {
  try {
    const { data: existing } = await supabaseAdmin!
      .from('customers')
      .select('email, mobile')
      .eq('id', customerId)
      .single();

    if (!existing) return null;

    const updatePayload: any = {};

    // ── EMAIL UNMASKING LOGIC ──
    const currentEmailMasked = isMasked(existing.email);
    const newEmailMasked = isMasked(extractedData.customer_email);

    if (extractedData.customer_email) {
      // If we have a new email, update if:
      // 1. Current DB is empty
      // 2. Current DB is masked AND new email is NOT masked
      if (!existing.email || (currentEmailMasked && !newEmailMasked)) {
        updatePayload.email = extractedData.customer_email;
      }
    }

    // ── MOBILE UNMASKING LOGIC ──
    const currentMobileMasked = isMasked(existing.mobile);
    const newMobileMasked = isMasked(extractedData.customer_mobile);

    if (extractedData.customer_mobile) {
      // Same logic for mobile
      if (!existing.mobile || (currentMobileMasked && !newMobileMasked)) {
        updatePayload.mobile = extractedData.customer_mobile;
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      const { data: updated } = await supabaseAdmin!
        .from('customers')
        .update(updatePayload)
        .eq('id', customerId)
        .select('email, mobile')
        .single();

      console.log(`[Dedup] Updated customer ${customerId} with ${Object.keys(updatePayload).join(', ')} (unmasking: ${currentEmailMasked || currentMobileMasked})`);
      return updated;
    }

    return existing;
  } catch (error) {
    console.error('[Dedup] Failed to update customer contacts:', error);
    return null;
  }
}

/**
 * Find or resolve insurer with deduplication
 */
export async function findOrCreateInsurer(insurerName: string | null | undefined): Promise<string | null> {
  if (!insurerName || insurerName.toLowerCase().includes('unknown')) {
    return null;
  }

  try {
    const normalized = normalizeCustomerName(insurerName);

    // Fetch all insurers
    const { data: allInsurers } = await supabaseAdmin!
      .from('insurers')
      .select('id, name');

    if (!allInsurers) return null;

    // Try exact match first
    const exactMatch = allInsurers.find(
      i => normalizeCustomerName(i.name) === normalized
    );

    if (exactMatch) {
      console.log(`[Insurer] Exact match: ${exactMatch.name}`);
      return exactMatch.id;
    }

    // Try fuzzy match
    let bestMatch: typeof allInsurers[0] | null = null;
    let bestScore = 0;

    for (const insurer of allInsurers) {
      const similarity = calculateNameSimilarity(insurerName, insurer.name);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = insurer;
      }
    }

    if (bestMatch && bestScore >= 0.8) {
      console.log(
        `[Insurer] Fuzzy match: ${bestMatch.name} (${(bestScore * 100).toFixed(1)}%)`
      );
      return bestMatch.id;
    }

    // Create new insurer
    const { data: newInsurer, error } = await supabaseAdmin!
      .from('insurers')
      .insert([{ name: insurerName }])
      .select('id')
      .single();

    if (error) {
      console.error('[Insurer] Failed to create insurer:', error);
      return null;
    }

    console.log(`[Insurer] Created new: ${insurerName} (ID: ${newInsurer.id})`);
    return newInsurer.id;
  } catch (error) {
    console.error('[Insurer] Error resolving insurer:', error);
    return null;
  }
}

// ============================================================================
// QUEUE & JOB MANAGEMENT
// ============================================================================

/**
 * Queue a document for extraction
 */
export async function queueDocumentExtraction(
  userId: string,
  documentId: string,
  policyId: string,
  fileUrl: string
) {
  const jobId = `extraction-${documentId}`;

  try {
    // Create job record in database
    const { data: extData, error: jobError } = await supabaseAdmin!
      .from('extraction_jobs')
      .insert([
        {
          document_id: documentId,
          status: 'queued',
          job_id: jobId,
        },
      ])
      .select('id')
      .single();

    if (jobError) throw jobError;
    const realJobId = extData.id;

    // Add to queue
    await enqueueExtractionJob(realJobId, documentId, userId, fileUrl);

    console.log(`[Queue] Job queued: ${realJobId} for document ${documentId}`);
    return { success: true, jobId: realJobId };
  } catch (error) {
    console.error('[Queue] Failed to queue extraction job:', error);
    throw error;
  }
}

/**
 * Inline extraction - runs OCR immediately during upload
 */
export async function extractDocumentInline(
  documentId: string,
  policyId: string,
  fileUrl: string
): Promise<{ success: boolean; extracted?: any; metrics?: PolicyExtractionMetrics; error?: string }> {
  console.log(`[Inline] Starting inline extraction for doc ${documentId}`);

  const startTime = Date.now();
  const metrics: PolicyExtractionMetrics = {
    jobId: documentId,
    success: false,
    duration: 0,
    customerDeduped: false,
    insurerResolved: false,
    extractedFields: {
      policy_number: false,
      customer_name: false,
      insurer_name: false,
      premium_amount: false,
    },
  };

  // Record extraction job
  const { data: jobRow } = await supabaseAdmin!
    .from('extraction_jobs')
    .insert([{ document_id: documentId, status: 'processing', job_id: `inline-${documentId}` }])
    .select('id')
    .single();

  const jobDbId = jobRow?.id;

  try {
    // Fetch mapping dependencies
    const { data: dbInsurers } = await supabaseAdmin!.from('insurers').select('name');
    const existingInsurers = dbInsurers?.map(i => i.name) || [];

    const { data: dbCusts } = await supabaseAdmin!.from('customers').select('name');
    const existingCustomers = dbCusts?.map(c => c.name) || [];

    // Run OCR
    console.log(`[Inline] Extracting text from ${fileUrl.substring(0, 50)}...`);
    const rawText = await ocrProvider.extractText(fileUrl);
    let extracted = await ocrProvider.extractStructuredData(rawText, existingInsurers, existingCustomers);

    // AUTO-CONSENSUS FALLBACK
    if (!extracted.customer_name || extracted.customer_name.toLowerCase().includes('unknown')) {
      console.log('[Inline] ⚠️ Missing customer name. Triggering Consensus AI Fallback...');
      extracted = await ocrProvider.consensusExtract(rawText, existingInsurers, existingCustomers);
    }

    console.log('[Inline] Extraction result:', {
      policy_number: extracted.policy_number,
      customer_name: extracted.customer_name,
      insurer_name: extracted.insurer_name,
      premium_amount: extracted.premium_amount,
    });

    metrics.extractedFields.policy_number = !!extracted.policy_number;
    metrics.extractedFields.customer_name = !!extracted.customer_name;
    metrics.extractedFields.insurer_name = !!extracted.insurer_name;
    metrics.extractedFields.premium_amount = extracted.premium_amount ? extracted.premium_amount > 0 : false;

    // ── INTELLIGENT CUSTOMER DEDUPLICATION ──
    const dedupeResult = await findOrCreateCustomer({
      customer_name: extracted.customer_name,
      customer_email: extracted.customer_email,
      customer_mobile: extracted.customer_mobile,
    });

    let finalCustId = dedupeResult?.customerId || null;
    metrics.customerDeduped = !!dedupeResult;

    // ── SMART CONTACT UNMASKING (ENRICHMENT) ──
    // If OCR found masked data but we have clean data in DB for this customer, use the clean data
    if (dedupeResult) {
      if (isMasked(extracted.customer_email) && dedupeResult.email && !isMasked(dedupeResult.email)) {
        console.log(`[Inline] 🛡️ Unmasked Email using history: ${dedupeResult.email}`);
        extracted.customer_email = dedupeResult.email;
      }
      if (isMasked(extracted.customer_mobile) && dedupeResult.mobile && !isMasked(dedupeResult.mobile)) {
        console.log(`[Inline] 🛡️ Unmasked Mobile using history: ${dedupeResult.mobile}`);
        extracted.customer_mobile = dedupeResult.mobile;
      }
    }

    // ── INSURER RESOLUTION ──
    const insurerId = await findOrCreateInsurer(extracted.insurer_name);
    metrics.insurerResolved = !!insurerId;

    // ── PARSE DATES ──
    const safeDate = (d: string | undefined, fallback: Date) => {
      if (!d) return fallback.toISOString();
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
    };

    const now = new Date();
    const nextYear = new Date(now.getTime() + 31536000000);
    const startDate = safeDate(extracted.coverage_start, now);
    const expiryDate = safeDate(extracted.coverage_end, nextYear);

    let agentNotes = extracted.agent_notes || '';
    if (extracted.is_quotation) {
      extracted.policy_type = `⚠️ QUOTATION / ILLUSTRATION`;
      agentNotes = `⚠️ AI FLAG: This document appears to be a Quotation, Proposal, or Benefit Illustration, NOT a final issued policy. Please verify and delete if incorrect.\n\n` + agentNotes;
    }

    let finalPolicyNumber = extracted.policy_number || `OCR-${Date.now()}`;
    if (extracted.requires_manual_entry) {
      finalPolicyNumber = `PENDING_OCR_MANUAL_${Date.now()}`;
      agentNotes = `⚠️ AI FLAG: Missing required fields (Premium / Sum Assured). Manual entry required.\n\n` + agentNotes;
      metrics.success = false;
      metrics.error = "Missing premium amount / sum assured.";
    }

    // ── UPDATE POLICY ──
    const updatePayload: any = {
      policy_number: finalPolicyNumber,
      policy_type: extracted.policy_type || 'General Insurance',
      start_date: startDate,
      expiry_date: expiryDate,
      premium_amount: extracted.premium_amount || 0,
      agent_notes: agentNotes || null,
    };

    if (finalCustId) updatePayload.customer_id = finalCustId;
    if (insurerId) updatePayload.insurer_id = insurerId;

    await supabaseAdmin!
      .from('policies')
      .update(updatePayload)
      .eq('id', policyId);

    // ── MARK DOCUMENT AS EXTRACTED ──
    await supabaseAdmin!
      .from('policy_documents')
      .update({
        extraction_status: 'extracted',
        raw_ocr_text: rawText.substring(0, 5000),
      })
      .eq('id', documentId);

    // ── MARK JOB AS COMPLETED ──
    if (jobDbId) {
      await supabaseAdmin!
        .from('extraction_jobs')
        .update({
          status: 'completed',
          extracted_data: extracted,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobDbId);
    }

    metrics.success = true;
    metrics.duration = Date.now() - startTime;

    console.log(
      `[Inline] ✅ Extraction complete for policy ${policyId} (${metrics.duration}ms)`,
      metrics
    );

    return { success: true, extracted, metrics };
  } catch (err: any) {
    metrics.error = err.message;
    metrics.duration = Date.now() - startTime;

    console.error('[Inline] Extraction failed:', err, metrics);

    if (jobDbId) {
      await supabaseAdmin!
        .from('extraction_jobs')
        .update({
          status: 'failed',
          error_message: err.message,
        })
        .eq('id', jobDbId);
    }

    // Don't throw — upload succeeded, extraction is best-effort
    return { success: false, error: err.message };
  }
}

/**
 * Process a single extraction job with retry logic
 */
export async function processExtractionJob(retryAttempt = 0): Promise<any> {
  console.log(`[Worker] Starting processExtractionJob (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})...`);

  const startTime = Date.now();
  const metrics: PolicyExtractionMetrics = {
    jobId: '',
    success: false,
    duration: 0,
    customerDeduped: false,
    insurerResolved: false,
    extractedFields: {
      policy_number: false,
      customer_name: false,
      insurer_name: false,
      premium_amount: false,
    },
  };

  let job;
  try {
    job = await getNextJob();
    if (!job) {
      console.log('[Worker] No job available');
      return null;
    }

    metrics.jobId = job.id;
    const { documentId, userId, fileUrl } = job.payload;

    console.log(
      `[Worker] Processing job ${job.id} - doc: ${documentId}, user: ${userId}, file: ${fileUrl?.substring(0, 50)}...`
    );

    // Mark job as processing
    await supabaseAdmin!
      .from('extraction_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id);

    // ── EXTRACT TEXT ──
    console.log(`[Worker] Extracting text from ${fileUrl}...`);
    const extractedText = await ocrProvider.extractText(fileUrl);
    console.log(`[Worker] Extracted ${extractedText.length} characters`);

    // ── FETCH ENTITY REFERENCES ──
    const { data: dbInsurers } = await supabaseAdmin!.from('insurers').select('name');
    const existingInsurers = dbInsurers?.map(i => i.name) || [];

    const { data: dbCusts } = await supabaseAdmin!.from('customers').select('name');
    const existingCustomers = dbCusts?.map(c => c.name) || [];

    console.log(
      `[Worker] Found ${existingInsurers.length} insurers and ${existingCustomers.length} customers`
    );

    // ── EXTRACT STRUCTURED DATA ──
    console.log(`[Worker] Extracting structured data...`);
    let structuredData = await ocrProvider.extractStructuredData(
      extractedText,
      existingInsurers,
      existingCustomers
    );

    // ── AUTO-CONSENSUS FALLBACK ──
    if (!structuredData.customer_name || structuredData.customer_name.toLowerCase().includes('unknown')) {
      console.log('[Worker] ⚠️ Missing customer name. Triggering Consensus AI Fallback...');
      structuredData = await ocrProvider.consensusExtract(
        extractedText,
        existingInsurers,
        existingCustomers
      );
    }

    console.log('[Worker] Structured data:', {
      customer_name: structuredData.customer_name,
      policy_number: structuredData.policy_number,
      insurer_name: structuredData.insurer_name,
    });

    metrics.extractedFields.policy_number = !!structuredData.policy_number;
    metrics.extractedFields.customer_name = !!structuredData.customer_name;
    metrics.extractedFields.insurer_name = !!structuredData.insurer_name;
    metrics.extractedFields.premium_amount = structuredData.premium_amount ? structuredData.premium_amount > 0 : false;

    // ── INTELLIGENT CUSTOMER DEDUPLICATION ──
    const dedupeResult = await findOrCreateCustomer({
      customer_name: structuredData.customer_name,
      customer_email: structuredData.customer_email,
      customer_mobile: structuredData.customer_mobile,
    });

    let finalCustId = dedupeResult?.customerId || null;
    metrics.customerDeduped = !!dedupeResult;

    // ── SMART CONTACT UNMASKING (ENRICHMENT) ──
    // If OCR found masked data but we have clean data in DB for this customer, use the clean data
    if (dedupeResult) {
      if (isMasked(structuredData.customer_email) && dedupeResult.email && !isMasked(dedupeResult.email)) {
        console.log(`[Worker] 🛡️ Unmasked Email using history: ${dedupeResult.email}`);
        structuredData.customer_email = dedupeResult.email;
      }
      if (isMasked(structuredData.customer_mobile) && dedupeResult.mobile && !isMasked(dedupeResult.mobile)) {
        console.log(`[Worker] 🛡️ Unmasked Mobile using history: ${dedupeResult.mobile}`);
        structuredData.customer_mobile = dedupeResult.mobile;
      }
    }

    // ── INSURER RESOLUTION ──
    const insurerId = await findOrCreateInsurer(structuredData.insurer_name);
    metrics.insurerResolved = !!insurerId;

    // ── UPDATE EXTRACTION JOB ──
    await supabaseAdmin!
      .from('extraction_jobs')
      .update({
        status: 'completed',
        extracted_data: structuredData,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    // ── FETCH POLICY & UPDATE ──
    const { data: docData } = await supabaseAdmin!
      .from('policy_documents')
      .update({ extraction_status: 'extracted' })
      .eq('id', documentId)
      .select('policy_id')
      .single();

    if (docData?.policy_id) {
      const now = new Date();
      const nextYear = new Date(now.getTime() + 31536000000);

      const updatePayload: any = {
        policy_number: structuredData.policy_number || `OCR_${Date.now()}`,
        policy_type: structuredData.policy_type || 'General Insurance',
        start_date: structuredData.coverage_start
          ? new Date(structuredData.coverage_start).toISOString()
          : now.toISOString(),
        expiry_date: structuredData.coverage_end
          ? new Date(structuredData.coverage_end).toISOString()
          : nextYear.toISOString(),
        premium_amount: structuredData.premium_amount || 0,
        status: 'active',
      };

      if (finalCustId) updatePayload.customer_id = finalCustId;
      if (insurerId) updatePayload.insurer_id = insurerId;

      await supabaseAdmin!
        .from('policies')
        .update(updatePayload)
        .eq('id', docData.policy_id);

      console.log(`[Worker] Policy ${docData.policy_id} updated successfully`);
    }

    // ── MARK JOB COMPLETE ──
    await completeJob(job.id, structuredData);

    metrics.success = true;
    metrics.duration = Date.now() - startTime;

    console.log(`[Worker] ✅ Job ${job.id} completed successfully`, metrics);

    return {
      success: true,
      jobId: job.id,
      data: structuredData,
      metrics,
    };
  } catch (error: any) {
    metrics.error = error.message;
    metrics.duration = Date.now() - startTime;

    console.error(`[Worker] Job ${metrics.jobId} failed:`, error.message, metrics);

    if (job) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update job with error
      await supabaseAdmin!
        .from('extraction_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', job.id);

      // Retry logic
      if (retryAttempt < MAX_RETRY_ATTEMPTS - 1) {
        console.log(
          `[Worker] Retrying in ${RETRY_BACKOFF_MS}ms (attempt ${retryAttempt + 2}/${MAX_RETRY_ATTEMPTS})...`
        );
        await new Promise(resolve => setTimeout(resolve, RETRY_BACKOFF_MS));
        return processExtractionJob(retryAttempt + 1);
      } else {
        await failJob(job.id, errorMessage);
      }
    }

    throw error;
  }
}

/**
 * Batch process multiple extraction jobs with parallel limit
 * Reads queued jobs directly from DB and calls extractDocumentInline per job.
 */
export async function processBulkExtractions(
  maxConcurrent = BATCH_PROCESSING_LIMIT
): Promise<PolicyExtractionMetrics[]> {
  console.log(`[Bulk] Starting bulk extraction (max ${maxConcurrent} concurrent)...`);

  const limiter = pLimit(maxConcurrent);
  const results: PolicyExtractionMetrics[] = [];

  try {
    // Fetch queued jobs with their document details
    const { data: pendingJobs, error: fetchError } = await supabaseAdmin!
      .from('extraction_jobs')
      .select(`
        id,
        document_id,
        policy_documents!extraction_jobs_document_id_fkey (
          id,
          file_path,
          policy_id
        )
      `)
      .eq('status', 'queued')
      .limit(50);

    if (fetchError) {
      console.error('[Bulk] Failed to fetch pending jobs:', fetchError);
      // Fallback: try without join
      const { data: simpleJobs } = await supabaseAdmin!
        .from('extraction_jobs')
        .select('id, document_id')
        .eq('status', 'queued')
        .limit(50);

      if (!simpleJobs || simpleJobs.length === 0) return results;

      // For each job, look up the document separately
      const jobPromises = simpleJobs.map(job =>
        limiter(async () => {
          const { data: doc } = await supabaseAdmin!
            .from('policy_documents')
            .select('id, file_path, policy_id')
            .eq('id', job.document_id)
            .maybeSingle();

          if (!doc?.file_path) {
            await supabaseAdmin!.from('extraction_jobs')
              .update({ status: 'failed', error_message: 'Document not found' })
              .eq('id', job.id);
            return null;
          }

          const { data: urlData } = supabaseAdmin!.storage
            .from('policy-documents')
            .getPublicUrl(doc.file_path);

          const result = await extractDocumentInline(doc.id, doc.policy_id, urlData.publicUrl);
          if (result.metrics) results.push(result.metrics);
          return result;
        })
      );

      await Promise.allSettled(jobPromises);
      return results;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('[Bulk] No pending jobs');
      return results;
    }

    console.log(`[Bulk] Found ${pendingJobs.length} pending jobs to process`);

    const jobPromises = pendingJobs.map(job =>
      limiter(async () => {
        const doc = (job as any).policy_documents;
        if (!doc?.file_path) {
          console.warn(`[Bulk] No document found for job ${job.id}`);
          await supabaseAdmin!.from('extraction_jobs')
            .update({ status: 'failed', error_message: 'Document not found' })
            .eq('id', job.id);
          return null;
        }

        const { data: urlData } = supabaseAdmin!.storage
          .from('policy-documents')
          .getPublicUrl(doc.file_path);

        const result = await extractDocumentInline(
          doc.id,
          doc.policy_id,
          urlData.publicUrl
        );

        if (result.metrics) results.push(result.metrics);
        return result;
      })
    );

    await Promise.allSettled(jobPromises);

    const stats = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    };
    console.log('[Bulk] Batch processing complete:', stats);
    return results;
  } catch (error) {
    console.error('[Bulk] Bulk extraction failed:', error);
    return results;
  }
}


/**
 * Get extraction job status
 */
export async function getExtractionStatus(jobId: string) {
  try {
    const { data, error } = await supabaseAdmin!
      .from('extraction_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[Status] Failed to get extraction status:', error);
    throw error;
  }
}

/**
 * Get extraction statistics
 */
export async function getExtractionStats(): Promise<{
  totalJobs: number;
  pendingJobs: number;
  completedJobs: number;
  failedJobs: number;
  processingJobs: number;
}> {
  try {
    const { data: allJobs } = await supabaseAdmin!
      .from('extraction_jobs')
      .select('status');

    if (!allJobs) {
      return {
        totalJobs: 0,
        pendingJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        processingJobs: 0,
      };
    }

    return {
      totalJobs: allJobs.length,
      pendingJobs: allJobs.filter(j => j.status === 'queued').length,
      completedJobs: allJobs.filter(j => j.status === 'completed').length,
      failedJobs: allJobs.filter(j => j.status === 'failed').length,
      processingJobs: allJobs.filter(j => j.status === 'processing').length,
    };
  } catch (error) {
    console.error('[Stats] Failed to get stats:', error);
    return {
      totalJobs: 0,
      pendingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      processingJobs: 0,
    };
  }
}

/**
 * Cleanup old extraction jobs (older than 30 days)
 */
export async function cleanupOldExtractionJobs(daysOld = 30): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data: oldJobs, error: fetchError } = await supabaseAdmin!
      .from('extraction_jobs')
      .select('id')
      .lt('created_at', cutoffDate.toISOString());

    if (fetchError || !oldJobs) return 0;

    if (oldJobs.length > 0) {
      const { error: deleteError } = await supabaseAdmin!
        .from('extraction_jobs')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (!deleteError) {
        console.log(`[Cleanup] Removed ${oldJobs.length} jobs older than ${daysOld} days`);
      }
    }

    return oldJobs.length;
  } catch (error) {
    console.error('[Cleanup] Failed to cleanup old jobs:', error);
    return 0;
  }
}
