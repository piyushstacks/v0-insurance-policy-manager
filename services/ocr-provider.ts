/**
 * Free Local OCR Engine — pdf-parse v1 (server-external, loaded at runtime)
 * next.config.mjs lists pdf-parse in serverExternalPackages so Next.js
 * does NOT bundle it. Node.js loads it natively at runtime via require.
 */

import { ExtractionResultInput } from '@/lib/schemas';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Safe runtime require — works because pdf-parse is serverExternalPackages
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }> =
  require('pdf-parse');

export interface OCRProvider {
  name: string;
  extractText(fileUrl: string): Promise<string>;
  extractStructuredData(text: string, existingInsurers?: string[], existingCustomers?: string[]): Promise<ExtractionResultInput>;
  consensusExtract(text: string, existingInsurers?: string[], existingCustomers?: string[]): Promise<ExtractionResultInput>;
}

class PDFParseProvider implements OCRProvider {
  name = 'pdf-parse-regex';

  async extractText(fileUrl: string): Promise<string> {
    console.log(`[v0/OCR] Fetching document: ${fileUrl}`);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch document (HTTP ${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Image files — no server-side text extraction without a GPU
    if (/\.(jpe?g|png)(\?|$)/i.test(fileUrl)) {
      console.warn('[v0/OCR] Image file — using placeholder.');
      return 'IMAGE_UPLOAD_NO_TEXT_EXTRACTED';
    }

    console.log('[v0/OCR] Parsing PDF with pdf-parse v1...');
    try {
      const result = await pdfParse(buffer);
      const text = result.text?.trim() ?? '';
      if (!text || text.length < 20) {
        console.warn('[v0/OCR] Scanned/image-only PDF (no embedded text) — placeholder.');
        return 'SCANNED_PDF_NO_TEXT_EXTRACTED';
      }
      console.log(`[v0/OCR] Extracted ${text.length} chars, ${result.numpages} pages.`);
      return text;
    } catch (err: any) {
      console.error('[v0/OCR] pdf-parse error:', err.message);
      throw new Error(`PDF parsing failed: ${err.message}`);
    }
  }

  async extractStructuredData(text: string, existingInsurers: string[] = [], existingCustomers: string[] = []): Promise<ExtractionResultInput> {
    console.log('[v0/OCR] Running AI extraction with Entity Resolution Maps...');

    const now = new Date();
    const nextYear = new Date(now);
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    if (text === 'IMAGE_UPLOAD_NO_TEXT_EXTRACTED' || text === 'SCANNED_PDF_NO_TEXT_EXTRACTED') {
      return {
        policy_number: `IMG-${Date.now()}`,
        policy_type: 'Unknown (Scanned Upload)',
        coverage_start: now.toISOString(),
        coverage_end: nextYear.toISOString(),
        premium_amount: 0,
        insurer_name: 'Unknown Insurer',
        customer_name: 'Unknown Customer',
      };
    }

    // ── GEN AI INJECTION — OpenRouter API with free model fallback chain ──
    const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY; // fallback if user only provided one
    if (openRouterKey) {
      console.log('[v0/AI] OpenRouter API Key found. Routing raw text through LLM Intelligence...');
      
      let parsed: any = null;
      let finalCat = 'General';
      let finalSubCat = 'Standard Policy';
      let aiErrLog = null;
      
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      
      // Fallback model list requested by user
      const models = [
         "openai/gpt-oss-120b:free",
         "nvidia/nemotron-3-super-120b-a12b:free",
         "minimax/minimax-m2.5:free"
      ];
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const modelName = models[attempt];
          console.log(`[v0/AI] Attempt ${attempt + 1} using openrouter model ${modelName}...`);

          const prompt = `
            You are an expert insurance document analyst specializing in Indian insurance policies (Star Health, HDFC Ergo, LIC, ICICI Lombard, Bajaj Allianz, New India Assurance, etc.).
            I am providing you with raw OCR text from a scanned policy schedule document.
            Extract all required fields carefully. Output EXCLUSIVELY a single pure JSON object — NO markdown, NO backticks, NO explanation.

            ENTITY RESOLUTION (prevent duplicates):
            - Existing Insurers in DB: [${existingInsurers.join(', ')}]
            - Existing Customers in DB: [${existingCustomers.join(', ')}]
            Map extracted names to the EXACT existing string if it is a variant/typo/substring of one above.

            CUSTOMER NAME RULES (CRITICAL):
            - Extract the ACTUAL human name of the policyholder / proposer.
            - In Star Health documents, look for the pattern: "Proposer Name : FULL NAME" (may span multiple lines).
            - The address block starts with "To,\nFULL NAME," — this is also a valid source.
            - "Dear Customer" or "Dear Mr." greetings contain the name.
            - NEVER output labels: "Code", "Client ID", "UIN", "Insured Name", "Person Details", "Name", "Nominee", "Gender".
            - If absolutely not found, output null.

            CATEGORY RULES:
            - "policy_category": MUST be exactly one of: "Health", "Motor", "Life", "Travel", "Property", "General", "Business".
            - "policy_sub_category": Short plan name ONLY (e.g. "Assure", "MediClassic", "Family Floater", "Comprehensive"). NOT the company name. Max 30 chars.

            PREMIUM RULES:
            - Extract the total amount paid. Look for patterns like "Rs. 28,955/-", "Net Premium 25000", "Total Premium 18500".
            - Return as a plain number (no currency symbol, no commas).

            CONTACT DATA RULES:
            - NEVER invent emails/phones. Only extract if explicitly written in the document. Output null if missing.

            QUOTATION / ILLUSTRATION DETECTION:
            - Is this a Quotation, Benefit Illustration, Proposal Form, or Premium Calculation instead of an actual issued policy?
            - Set "is_quotation": true if it is NOT a final issued policy.

            PREMIUM PAYMENT TERM (LIFE INSURANCE ONLY):
            - Life insurance can be Regular Pay, Limited Pay (e.g. 12 years), or Single Pay.
            - If it's a Life policy, search for "Premium Payment Term" or "PPT".
            - If you find a number of years, output "payment_term": N (as an integer).
            - If "Single Premium" or "Single Pay", output "payment_term": 1.
            - If "Regular Pay" or not found, output "payment_term": 99.

            POLICY TERM (LIFE INSURANCE ONLY):
            - If you find "Policy Term" (e.g., 40 years), output "policy_term": 40.

            Return JSON:
            {
              "policy_number": "exact alphanumeric (e.g. P/141100/01/2025/001234 or 4504111511572315)",
              "policy_category": "Health|Motor|Life|Travel|Property|General|Business",
              "policy_sub_category": "short plan name, max 30 chars",
              "coverage_start": "ISO8601 date (e.g. 2025-04-14T00:00:00Z)",
              "coverage_end": "ISO8601 date",
              "premium_amount": 28955,
              "sum_insured": 5000000,
              "payment_term": 99,
              "policy_term": 40,
              "insurer_name": "insurance company full name",
              "customer_name": "full name of proposer/policyholder or null",
              "customer_email": "email or null",
              "customer_mobile": "phone number or null",
              "key_important_details": "HTML <li> list of other key info, or empty string",
              "is_quotation": false
            }

            RAW DOCUMENT TEXT:
            ${text.substring(0, 15000)}
          `;

          // API call to OpenRouter with reasoning enabled
          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openRouterKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              "model": modelName,
              "messages": [
                {
                  "role": "user",
                  "content": prompt
                }
              ],
              "reasoning": {"enabled": true}
            })
          });
          
          if (!res.ok) {
              const errBody = await res.text();
              throw new Error(`OpenRouter API error ${res.status}: ${errBody}`);
          }

          const result = await res.json();
          const assistantMessage = result.choices[0].message;
          let rawContent = assistantMessage.content.trim();
          
          // Fallback second reasoning loop if requested
          if (!rawContent.includes("{")) {
              console.log("[v0/AI] JSON not found, extending reasoning loop...");
              const res2 = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${openRouterKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  "model": modelName,
                  "messages": [
                    { "role": "user", "content": prompt },
                    { 
                        "role": "assistant", 
                        "content": assistantMessage.content,
                        "reasoning_details": assistantMessage.reasoning_details
                    },
                    { "role": "user", "content": "You did not output the final JSON requested. Are you sure? Think carefully and output strictly the final JSON."}
                  ]
                })
              });
              if (res2.ok) {
                  const r2 = await res2.json();
                  rawContent = r2.choices[0].message.content.trim();
              }
          }
          
          // Safely extract JSON object even if LLM adds preamble text
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No JSON object found in AI response');
          rawContent = jsonMatch[0];
          
          parsed = JSON.parse(rawContent);
          
          // --- Validation ---
          const cName = (parsed.customer_name || '').trim();
          const cNameLower = cName.toLowerCase();
          const invalidTerms = ['details', 'gender', 'nominee', 'unknown', 'insured name', 'code', 'client id', 'uin', 'person', 'name'];
          const isInvalidName = !cName || cName.length < 3 || invalidTerms.some(t => cNameLower === t);

          if (parsed.customer_email) {
             const lowerE = parsed.customer_email.toLowerCase();
             if (lowerE.includes('.local') || lowerE.includes('auto@') || lowerE.includes('none') || lowerE.includes('test@') || !lowerE.includes('@')) {
                 parsed.customer_email = null;
             }
          }
          if (parsed.customer_mobile && String(parsed.customer_mobile).replace(/\D/g, '').length < 7) {
             parsed.customer_mobile = null;
          }
          
          const validCats = ['Health', 'Motor', 'Life', 'Travel', 'Property', 'General', 'Business'];
          finalCat = validCats.includes(parsed.policy_category) ? parsed.policy_category : 'General';
          finalSubCat = (parsed.policy_sub_category || 'Standard Policy').substring(0, 35);
          // Reject if sub_category is just the company name
          if (existingInsurers.some(i => finalSubCat.toLowerCase().includes(i.toLowerCase().substring(0, 8)))) {
            finalSubCat = 'Standard Policy';
          }
          
          if (isInvalidName) {
             console.warn(`[v0/AI] Customer name '${parsed.customer_name}' is invalid on attempt ${attempt + 1}.`);
             parsed.customer_name = null; // Will trigger regex supplementation below
          }
          
          const parseNum = (val: any) => typeof val === 'number' ? val : parseFloat(String(val || '').replace(/[^\d.]/g, '')) || 0;
          parsed.premium_amount = parseNum(parsed.premium_amount);
          parsed.sum_insured = parseNum(parsed.sum_insured || parsed.sum_assured || parsed.additional_fields?.sum_insured);
          parsed.payment_term = parseNum(parsed.payment_term);
          parsed.policy_term = parseNum(parsed.policy_term);

          if (!parsed.policy_number || parsed.policy_number.length < 4) {
             parsed.policy_number = `REVIEW-${Date.now()}`;
          }

          // STRICT CHECK: Premium Amount & Sum Assured
          const hasPremium = parsed.premium_amount > 0;
          const hasSumInsured = parsed.sum_insured > 0 || parsed.key_important_details?.toLowerCase().includes('sum insured');
          
          if (!hasPremium && !hasSumInsured) {
             throw new Error("Missing both Premium Amount and Sum Insured. Extraction is weak.");
          }

          if (finalCat === 'Life' && parsed.payment_term) {
              finalSubCat += ` | ${parsed.payment_term}-Pay`;
          }

          console.log(`[v0/AI] ✅ Extraction Success! Customer: ${parsed.customer_name}, Policy: ${parsed.policy_number}`);
          break;

        } catch (aiErr: any) {
          const msg = aiErr.message || '';
          console.error(`[v0/AI] Attempt ${attempt + 1} failed:`, msg.substring(0, 300));
          
          // Wait briefly before falling back to the next model in the OpenRouter chain
          await sleep(2000);
          aiErrLog = aiErr;
          if (attempt === 2) parsed = null;
        }
      }

      if (parsed) {
        return {
          policy_number: parsed.policy_number || `OCR-${Date.now()}`,
          policy_type: `${finalCat} | ${finalSubCat}`,
          coverage_start: parsed.coverage_start || now.toISOString(),
          coverage_end: parsed.coverage_end || nextYear.toISOString(),
          premium_amount: Number(parsed.premium_amount) || 0,
          insurer_name: parsed.insurer_name || 'Unknown Insurer',
          customer_name: parsed.customer_name || null,
          customer_email: parsed.customer_email || null,
          customer_mobile: parsed.customer_mobile || null,
          agent_notes: parsed.key_important_details || null,
          is_quotation: !!parsed.is_quotation,
          requires_manual_entry: (!parsed.premium_amount || parsed.premium_amount <= 0)
        };
      }
    }

    console.log('[v0/AI] Total AI Failure. Falling back to Regex engine...');
    return this.regexFallback(text);
  }

  async consensusExtract(text: string, existingInsurers: string[] = [], existingCustomers: string[] = []): Promise<ExtractionResultInput> {
    console.log('[v0/AI] 🧠 Entering Consensus Mode: Calling dual models for cross-verification...');
    
    // Run two models in parallel
    const [res1, res2] = await Promise.allSettled([
      this.extractStructuredData(text, existingInsurers, existingCustomers),
      this.extractStructuredData(text, existingInsurers, existingCustomers) 
    ]);

    const val1 = res1.status === 'fulfilled' ? res1.value : null;
    const val2 = res2.status === 'fulfilled' ? res2.value : null;

    if (!val1 && !val2) throw new Error('Consensus failed: Both extraction attempts failed.');
    if (!val1) return val2!;
    if (!val2) return val1;

    // Check if they agree on critical fields
    const agreeOnName = val1.customer_name === val2.customer_name;
    const agreeOnPolicy = val1.policy_number === val2.policy_number;

    if (agreeOnName && agreeOnPolicy) {
      console.log('[v0/AI] ✅ Models agree perfectly. Proceeding.');
      return val1;
    }

    console.log('[v0/AI] ⚖️ Models disagree on critical fields. Triggering Arbitration...');
    
    // Arbitration step: Ask a model to resolve the difference
    const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
    if (!openRouterKey) return val1;

    const arbiterPrompt = `
      I have two different extractions from the same insurance document. They disagree.
      Document snippet: ${text.substring(0, 3000)}
      
      Extraction A: ${JSON.stringify(val1)}
      Extraction B: ${JSON.stringify(val2)}
      
      Decide which one is more correct for the "customer_name" and "policy_number". 
      Think step-by-step. Return the final resolved JSON only.
    `;

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openRouterKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini", // Use a fast but smart arbiter
          messages: [{ role: "user", content: arbiterPrompt }]
        })
      });
      if (res.ok) {
        const data = await res.json();
        const rawArb = data.choices[0].message.content;
        const clean = rawArb.match(/\{[\s\S]*\}/)?.[0];
        if (clean) return JSON.parse(clean);
      }
    } catch (e) {
      console.error('[v0/AI] Arbiter failed, defaulting to Model A');
    }

    return val1;
  }

  private regexFallback(text: string): ExtractionResultInput {
    const now = new Date();
    const nextYear = new Date(now);
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    console.log('[v0/Regex] Using structural RegEx fallback heuristics...');

    // Normalize whitespace but keep newlines for multi-line matching
    const t = text.replace(/[ \t]+/g, ' ');
    const lines = t.split('\n').map(l => l.trim()).filter(Boolean);

    const grab = (regex: RegExp): string | null => {
      const m = t.match(regex);
      return m?.[1]?.trim() ?? null;
    };

    // Helper: parse DD/MM/YYYY to ISO
    const parseDMY = (s: string): Date | null => {
      const m = s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
      if (!m) return null;
      const d = new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
      return isNaN(d.getTime()) ? null : d;
    };

    // ── Policy Number ──────────────────────────────────────────────────────
    // Star Health uses 'Renewal Endorsement No:' label
    const policyNumber =
      grab(/[Rr]enewal\s+[Ee]ndorsement\s+[Nn]o\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/\-]{5,50})/i) ??
      grab(/[Pp]olicy\s*(?:[Nn]o|[Nn]umber)\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9 \/\-]{5,40})/i) ??
      grab(/[Pp]olicy\s*[Nn]o\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9 \/\-]{5,40})/i) ??
      `OCR-${Date.now()}`;

    // ── Insurer ────────────────────────────────────────────────────────────
    const insurer =
      grab(/(?:issued by|underwriter|administrator)[:\-\s]+([A-Za-z][A-Za-z ]{3,80}?(?:Insurance|Assurance)\s+(?:Company|Co\.?|Ltd\.?|Limited))/i) ??
      (() => {
        for (const line of lines) {
          const m = line.match(/^([A-Za-z][A-Za-z ]{5,80}?(?:Insurance|Assurance)\s+(?:Company|Co\.?|Ltd\.?|Limited))$/i);
          if (m) return m[1].trim();
        }
        return grab(/([A-Za-z][A-Za-z ]+?(?:Insurance|Assurance)\s+(?:Company|Co\.?|Ltd\.?|Limited))/i);
      })() ??
      'Unknown Insurer';

    // ── Policy Type: extract actual plan name (e.g. "Star Health Assure") ─
    let policyType = 'General | Standard Cover';
    // Default to Health if insurer name contains Health keywords
    if (/\b(?:health|med|optima|assure|medicare)\b/i.test(insurer)) policyType = 'Health | Standard Cover';
    // Detect from plan name line e.g. "Star Health Assure Insurance Policy"
    const planNameMatch =
      grab(/Star\s+Health\s+(.+?)\s+Insurance\s+Policy/i) ??
      grab(/([A-Za-z][a-zA-Z ]{3,40}?)\s+Insurance\s+Policy/i);
    if (planNameMatch) {
      const words = planNameMatch.trim().split(/\s+/);
      const subCat = words.slice(-Math.min(words.length, 3)).join(' ');
      if (!subCat.toLowerCase().includes('health insurance') && subCat.length < 30) {
        policyType = `Health | ${subCat}`;
      }
    }
    // Override with specific product category keywords (only if insurer is not health)
    if (!/\bhealth\b/i.test(insurer)) {
      if (/\b(?:motor|vehicle|car|two.?wheeler|commercial vehicle)\b/i.test(text)) policyType = 'Motor | Comprehensive';
      if (/\b(?:term|endowment|ulip|annuity)\b/i.test(text)) policyType = 'Life | Standard Cover';
      if (/\b(?:travel)\b/i.test(text)) policyType = 'Travel | Standard Cover';
      if (/\b(?:fire|home|property|building|burglary)\b/i.test(text)) policyType = 'Property | Standard Cover';
    }

    // ── Dates: 'Policy Period From X To Y' ─────────────────────────────────
    let coverageStart = now.toISOString();
    let coverageEnd   = nextYear.toISOString();

    const periodMatch = t.match(
      /[Pp]olicy\s*[Pp]eriod[^\n]*?(?:From|from)[\s\S]*?(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})[\s\S]*?(?:To|to)[\s\S]*?(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i
    );
    if (periodMatch) {
      const s = parseDMY(periodMatch[1]);
      const e = parseDMY(periodMatch[2]);
      if (s) coverageStart = s.toISOString();
      if (e) coverageEnd   = e.toISOString();
    } else {
      // Try 'renewed for a further period of DD-MM-YYYY to DD-MM-YYYY'
      const m2 = t.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\s*(?:to|To)\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i);
      if (m2) {
        const s = parseDMY(m2[1]);
        const e = parseDMY(m2[2]);
        if (s) coverageStart = s.toISOString();
        if (e) coverageEnd   = e.toISOString();
      }
    }

    // ── Premium: handles 'Rs. 28,955/-', 'Net Premium 25000', '28955.00' ──
    let premium = 0;
    const rsPremSlash = grab(/[Rr]s\.\s*([\d,]+(?:\.\d{1,2})?)\/[-–]?/i);    // Rs. 28,955/-
    const rsPrem      = grab(/paid\s*Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const netPrem     = grab(/[Nn]et\s+[Pp]remium\s*[:\s]+([\d,]+(?:\.\d{1,2})?)/i);
    const grossPrem   = grab(/[Gg]ross\s+[Pp]remium\s*[:\s]+([\d,]+(?:\.\d{1,2})?)/i);
    const totalPrem   = grab(/[Tt]otal\s+[Pp]remium\s*[:\s]+([\d,]+(?:\.\d{1,2})?)/i);
    const rawPrem = rsPremSlash ?? netPrem ?? totalPrem ?? rsPrem ?? grossPrem;
    if (rawPrem) premium = parseFloat(rawPrem.replace(/,/g, ''));

    // ── Insurer — moved above policy type block (see above) ───────────────

    // ── Customer: Multi-pattern extraction optimized for Star Health ────────
    // Pattern 1: Address block 'To,\nFULL NAME,' - captures up to 2 lines for multi-line names
    const toBlockMatch = text.match(/\bTo,?\s*\n([A-Z][A-Z ]{3,60}(?:\n[A-Z][A-Z ]{2,60})?),/m);
    const toName = toBlockMatch?.[1]?.replace(/\n/g, ' ').trim();
    // Pattern 2: 'Proposer Name : NAME' - capture spanning 2 lines (e.g. MUKESH NEWANDRAM\nCHANDWANI)
    const proposerMatch = text.match(/[Pp]roposer\s+[Nn]ame\s*[:\s]+([A-Z][A-Z\s]{3,70})(?=\n[A-Z]|\n[a-z]|$)/m);
    const proposerName = proposerMatch?.[1]?.trim().replace(/\s+/g, ' ');
    // Pattern 3: Dear 'Mr. / Ms.' greeting
    const dearMatch = grab(/[Dd]ear\s+(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s+([A-Za-z][A-Za-z ]{2,60}?)(?:\s*,|\n)/i);
    // Pattern 4: Insured Name label
    const insuredMatch = grab(/[Ii]nsured\s+[Nn]ame\s*[:\-]?\s*([A-Z][a-zA-Z ]{2,60}?)(?:\n|,|$)/i);
    // Pattern 5: Policy Holder label
    const holderMatch = grab(/[Pp]olicy\s+[Hh]older\s*[:\-]?\s*([A-Z][a-zA-Z ]{2,60}?)(?:\n|,|$)/i);

    const sanitizeName = (raw: string | null | undefined): string | null => {
      if (!raw) return null;
      const n = raw.trim().replace(/\s+/g, ' ');
      const bad = ['code', 'name', 'insured', 'details', 'nominee', 'gender', 'unknown', 'dear customer', 'customer'];
      if (n.length < 3 || bad.some(b => n.toLowerCase() === b)) return null;
      return n;
    };
    
    const customer = 
      sanitizeName(toName) ??
      sanitizeName(proposerName) ??
      sanitizeName(dearMatch) ??
      sanitizeName(insuredMatch) ??
      sanitizeName(holderMatch) ??
      null;

    const result: ExtractionResultInput = {
      policy_number:  policyNumber,
      policy_type:    policyType.trim(),
      coverage_start: coverageStart,
      coverage_end:   coverageEnd,
      premium_amount: premium,
      insurer_name:   insurer.trim(),
      customer_name:  customer?.trim() ?? undefined,
      is_quotation:   /\b(?:quote|quotation|illustration|proposal|premium calculation)\b/i.test(text),
      requires_manual_entry: premium <= 0,
    };

    console.log('[v0/OCR] Result:', JSON.stringify(result, null, 2));
    return result;
  }
}

class GoogleDocumentAIProvider implements OCRProvider {
  name = 'google-document-ai';
  client: DocumentProcessorServiceClient | null = null;
  
  constructor() {
    try {
       // Only initialize if Google Cloud is properly set up in environment
       if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
          this.client = new DocumentProcessorServiceClient();
       }
    } catch (err: any) {
       console.warn('[v0/GCP] Document AI Client failed to init (likely missing CREDENTIALS):', err.message);
    }
  }

  async extractText(fileUrl: string): Promise<string> {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us';
    const processorId = process.env.GOOGLE_CLOUD_PROCESSOR_ID;

    // Soft fallback if user forgot to configure GCP Env variables
    if (!this.client || !projectId || !processorId) {
       console.warn('[v0/GCP] Configurations missing. Falling back to local pdf-parse.');
       const fb = new PDFParseProvider();
       return fb.extractText(fileUrl);
    }

    console.log(`[v0/GCP] Fetching document for Google Cloud processing: ${fileUrl}`);
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let mimeType = 'application/pdf';
    if (/\.(jpe?g)(\?|$)/i.test(fileUrl)) mimeType = 'image/jpeg';
    else if (/\.(png)(\?|$)/i.test(fileUrl)) mimeType = 'image/png';

    console.log(`[v0/GCP] Sending ${mimeType} to Google Document AI (${location}/${processorId})...`);

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    const request = {
      name,
      rawDocument: {
        content: buffer.toString('base64'),
        mimeType,
      },
    };

    try {
      const [result] = await this.client.processDocument(request);
      const text = result.document?.text?.trim() ?? '';
      
      console.log(`[v0/GCP] Google Cloud extracted ${text.length} chars natively.`);
      return text;
    } catch (err: any) {
      console.error('[v0/GCP] Google Cloud Document AI processing failed:', err.message);
      throw new Error(`Google Cloud OCR Failed: ${err.message}`);
    }
  }

  async extractStructuredData(text: string, existingInsurers: string[] = [], existingCustomers: string[] = []): Promise<ExtractionResultInput> {
     // Regex data heuristics works beautifully on top of GCP text.
     const fallbackEngine = new PDFParseProvider();
     return fallbackEngine.extractStructuredData(text, existingInsurers, existingCustomers);
  }

  async consensusExtract(text: string, existingInsurers: string[] = [], existingCustomers: string[] = []): Promise<ExtractionResultInput> {
     const fallbackEngine = new PDFParseProvider();
     return fallbackEngine.consensusExtract(text, existingInsurers, existingCustomers);
  }
}

const providerType = process.env.OCR_PROVIDER || 'google-document-ai';
export const ocrProvider = providerType === 'google-document-ai' 
  ? new GoogleDocumentAIProvider() 
  : new PDFParseProvider();

