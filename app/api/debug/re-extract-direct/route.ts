import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { runExtractionPipeline } from '@/services/extraction-pipeline';
import { 
  findOrCreateCustomer, 
  findOrCreateInsurer, 
  cleanNumber, 
  normalizeGender, 
  normalizeInsuranceType, 
  normalizePremiumFrequency, 
  normalizePaymentMode, 
  normalizeHealthPolicyType, 
  normalizeFuelType, 
  normalizeMotorPolicyType 
} from '@/services/extraction';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

// Concurrency helper
const limit = async (concurrency: number, tasks: (() => Promise<void>)[]) => {
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    const p = task().then(() => { executing.delete(p); });
    executing.add(p);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.EXTRACTION_WORKER_SECRET;

    if (!secretToken) {
      return NextResponse.json({ error: 'Worker not configured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${secretToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { policyId, onlyPending } = body;

    // 1. Fetch documents and corresponding policies
    let query = supabaseAdmin!
      .from('policy_documents')
      .select('id, file_path, raw_ocr_text, policy_id, policies!inner(user_id, policy_number)');

    if (policyId) {
      query = query.eq('policy_id', policyId);
    }

    const { data: docs, error: selectError } = await query;

    if (selectError) throw selectError;

    let filteredDocs = docs || [];
    if (onlyPending) {
      filteredDocs = filteredDocs.filter(d => {
        const num = (d.policies as any)?.policy_number || '';
        return num.startsWith('PENDING_OCR') || num.startsWith('BULK_OCR') || num.startsWith('IMG-') || num.startsWith('doc_');
      });
    }

    if (filteredDocs.length === 0) {
      return NextResponse.json({ success: true, message: 'No documents found.' });
    }

    console.log(`[Re-Extract] Starting background direct re-extraction for ${filteredDocs.length} documents...`);

    // Fire and forget background promise
    (async () => {
      const ocrProviderModule = await import('@/services/ocr-provider');
      const ocrProvider = ocrProviderModule.ocrProvider;

      const tasks = filteredDocs.map((doc, idx) => async () => {
        const docId = doc.id;
        const policyId = doc.policy_id;
        const policyUserId = (doc.policies as any)?.user_id || 'system';

        console.log(`[Re-Extract] [${idx + 1}/${filteredDocs.length}] Processing doc: ${docId} (policy: ${policyId})`);

        try {
          // Reset job record to processing
          await supabaseAdmin!
            .from('extraction_jobs')
            .upsert([{
              document_id: docId,
              status: 'processing',
              job_id: `re-extract-${docId}`,
              started_at: new Date().toISOString()
            }], { onConflict: 'document_id' });

          // 1. Get OCR Text — Force re-extract to bypass truncated 5000-character database cache
          let rawText = '';
          if (doc.file_path) {
            // Helper to generate public B2 URL
            const b2Bucket = process.env.B2_BUCKET_NAME || '';
            const b2PublicUrl = process.env.NEXT_PUBLIC_B2_PUBLIC_URL || '';
            const fileUrl = b2PublicUrl 
              ? `${b2PublicUrl.endsWith('/') ? b2PublicUrl.slice(0, -1) : b2PublicUrl}/${doc.file_path}`
              : `https://f000.backblazeb2.com/file/${b2Bucket}/${doc.file_path}`;

            console.log(`[Re-Extract] Run OCR on: ${fileUrl}`);
            rawText = await ocrProvider.extractText(fileUrl);
            
            // Save raw text back to policy_documents
            await supabaseAdmin!
              .from('policy_documents')
              .update({ raw_ocr_text: rawText.substring(0, 100000) })
              .eq('id', docId);
          }

          if (!rawText) {
            throw new Error('No raw text available and could not run OCR.');
          }

          // Fetch insurers & customers names for resolution
          const { data: dbInsurers } = await supabaseAdmin!.from('insurers').select('name');
          const existingInsurers = dbInsurers?.map(i => i.name) || [];
          const { data: dbCusts } = await supabaseAdmin!.from('customers').select('name');
          const existingCustomers = dbCusts?.map(c => c.name) || [];

          // 2. Run Pipeline
          const pipelineResult = await runExtractionPipeline(rawText, existingInsurers, existingCustomers);

          if (!pipelineResult.store) {
            console.log(`[Re-Extract] Doc ${docId} rejected: ${pipelineResult.reason}`);
            await supabaseAdmin!.from('extraction_jobs').update({
              status: 'rejected',
              error_message: `AI rejected: ${pipelineResult.reason}`,
              completed_at: new Date().toISOString()
            }).eq('document_id', docId);

            await supabaseAdmin!.from('policy_documents').update({
              extraction_status: 'rejected'
            }).eq('id', docId);

            await supabaseAdmin!.from('policies').update({
              policy_number: `REJECTED_${Date.now()}`,
              agent_notes: `⛔ AI FLAG: Document rejected. ${pipelineResult.reason}. Please delete if incorrect.`
            }).eq('id', policyId);

            return;
          }

          const ext = pipelineResult.extracted_data;

          // ── DEDUPLICATE CUSTOMER ──
          const dedupeResult = await findOrCreateCustomer({
            customer_name: ext.customer_name,
            customer_email: ext.customer_email,
            customer_mobile: ext.customer_mobile,
          }, policyUserId);

          let finalCustId = dedupeResult?.customerId || null;

          // ── RESOLVE INSURER ──
          const insurerId = await findOrCreateInsurer(ext.company || ext.insurer_name);

          // ── DATES ──
          const safeDate = (d: string | undefined, fallback: Date) => {
            if (!d) return fallback.toISOString();
            const parsed = new Date(d);
            return isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
          };

          const now = new Date();
          const startDate = safeDate(ext.policy_start_date, now);
          let nextEnd = new Date(new Date(startDate).getTime() + 31536000000);
          if (ext.policy_term) {
            const termEnd = new Date(startDate);
            termEnd.setFullYear(termEnd.getFullYear() + ext.policy_term);
            nextEnd = termEnd;
          }
          const expiryDate = safeDate(ext.policy_end_date, nextEnd);

          let agentNotes = ext.agent_notes || ext.notes || '';
          if (ext.requires_manual_entry) {
            agentNotes = `⚠️ AI FLAG: Missing critical fields (confidence: ${Math.round((pipelineResult.ai_confidence || 0) * 100)}%). Manual entry required.\n\n` + agentNotes;
          }

          // ── UPDATE POLICIES ──
          const updatePayload: any = {
            policy_number: ext.policy_number || `OCR-${Date.now()}`,
            policy_type: ext.policy_type || 'General Insurance',
            insurance_type: normalizeInsuranceType(ext.insurance_type),
            product_name: ext.product_name || null,
            proposal_number: ext.proposal_number || null,
            policy_holder_name: ext.policy_holder_name || null,
            issue_date: ext.issue_date || null,
            start_date: startDate,
            expiry_date: expiryDate,
            policy_start_date: startDate,
            policy_end_date: expiryDate,
            is_renewal: ext.is_renewal ?? false,
            premium_amount: cleanNumber(ext.premium_amount) || 0,
            gst_amount: cleanNumber(ext.gst_amount) || null,
            total_premium: cleanNumber(ext.total_premium) || cleanNumber(ext.premium_amount) || 0,
            sum_insured: cleanNumber(ext.sum_insured) || null,
            premium_frequency: normalizePremiumFrequency(ext.premium_frequency) || null,
            payment_mode: normalizePaymentMode(ext.payment_mode) || null,
            payment_date: ext.payment_date || null,
            agent_name: ext.agent_name || null,
            agent_code: ext.agent_code || null,
            branch: ext.branch || null,
            intermediary_code: ext.intermediary_code || null,
            ai_confidence: pipelineResult.ai_confidence || null,
            missing_fields: pipelineResult.missing_fields || null,
            notes: ext.notes || agentNotes || null,
            agent_notes: agentNotes || null,
          };

          if (finalCustId) updatePayload.customer_id = finalCustId;
          if (insurerId) updatePayload.insurer_id = insurerId;

          await supabaseAdmin!.from('policies').update(updatePayload).eq('id', policyId);

          // ── UPDATE CUSTOMER EXTENDED FIELDS ──
          if (finalCustId) {
            const custUpdate: any = {};
            if (ext.customer_dob)        custUpdate.dob = ext.customer_dob;
            if (ext.customer_gender)     custUpdate.gender = normalizeGender(ext.customer_gender);
            if (ext.customer_pan)        custUpdate.pan = ext.customer_pan;
            if (ext.customer_aadhaar)    custUpdate.aadhaar = ext.customer_aadhaar;
            if (ext.customer_ckyc)       custUpdate.ckyc_number = ext.customer_ckyc;
            if (ext.customer_eia)        custUpdate.eia_number = ext.customer_eia;
            if (ext.customer_gst)        custUpdate.gst_number = ext.customer_gst;
            if (ext.customer_occupation) custUpdate.occupation = ext.customer_occupation;
            if (ext.company_customer_id) custUpdate.company_customer_id = ext.company_customer_id;
            if (ext.customer_address)    custUpdate.address = ext.customer_address;
            if (Object.keys(custUpdate).length > 0) {
              await supabaseAdmin!.from('customers').update(custUpdate).eq('id', finalCustId);
            }
          }

          // ── SAVE DETAIL TABLE ──
          if (ext.insurance_type === 'life' && ext.life) {
            const l = ext.life;
            const { error: upsertErr } = await supabaseAdmin!.from('life_policies').upsert(
              { 
                policy_id: policyId, 
                ...l, 
                sum_assured: cleanNumber(l.sum_assured),
                premium_paying_term: cleanNumber(l.premium_paying_term),
                policy_term: cleanNumber(l.policy_term),
                riders: l.riders || [], 
                nominees: l.nominees || [] 
              },
              { onConflict: 'policy_id' }
            );
            if (upsertErr) throw upsertErr;
          } else if (ext.insurance_type === 'health' && ext.health) {
            const h = ext.health;
            const { error: upsertErr } = await supabaseAdmin!.from('health_policies').upsert(
              { 
                policy_id: policyId, 
                ...h, 
                policy_type: normalizeHealthPolicyType(h.policy_type),
                base_sum_insured: cleanNumber(h.base_sum_insured),
                total_sum_insured: cleanNumber(h.total_sum_insured),
                room_rent_limit: cleanNumber(h.room_rent_limit),
                icu_limit: cleanNumber(h.icu_limit),
                deductible: cleanNumber(h.deductible),
                members: h.members || [], 
                addons: h.addons || {} 
              },
              { onConflict: 'policy_id' }
            );
            if (upsertErr) throw upsertErr;
          } else if (ext.insurance_type === 'motor' && ext.motor) {
            const m = ext.motor;
            const { error: upsertErr } = await supabaseAdmin!.from('motor_policies').upsert(
              { 
                policy_id: policyId, 
                ...m, 
                fuel_type: normalizeFuelType(m.fuel_type),
                policy_type: normalizeMotorPolicyType(m.policy_type),
                idv: cleanNumber(m.idv),
                current_ncb_percent: cleanNumber(m.current_ncb_percent),
                manufacturing_year: cleanNumber(m.manufacturing_year),
                registration_year: cleanNumber(m.registration_year),
                covers: m.covers || {} 
              },
              { onConflict: 'policy_id' }
            );
            if (upsertErr) throw upsertErr;
          } else if (ext.insurance_type === 'commercial' && ext.commercial) {
            const c = ext.commercial;
            const { error: upsertErr } = await supabaseAdmin!.from('commercial_policies').upsert(
              { 
                policy_id: policyId, 
                ...c, 
                sum_insured_building: cleanNumber(c.sum_insured_building),
                sum_insured_stock: cleanNumber(c.sum_insured_stock),
                sum_insured: c.sum_insured || {}, 
                covers: c.covers || {} 
              },
              { onConflict: 'policy_id' }
            );
            if (upsertErr) throw upsertErr;
          }


          // Mark job & doc complete
          await supabaseAdmin!.from('extraction_jobs').update({
            status: 'completed',
            extracted_data: ext,
            completed_at: new Date().toISOString()
          }).eq('document_id', docId);

          await supabaseAdmin!.from('policy_documents').update({
            extraction_status: 'extracted'
          }).eq('id', docId);

          console.log(`[Re-Extract] [${idx + 1}/${docs.length}] \u001b[32m✔ Success!\u001b[39m`);
        } catch (taskErr: any) {
          console.error(`[Re-Extract] [${idx + 1}/${docs.length}] \u001b[31m❌ Failed:\u001b[39m`, taskErr.message);
          await supabaseAdmin!.from('extraction_jobs').update({
            status: 'failed',
            error_message: taskErr.message,
            completed_at: new Date().toISOString()
          }).eq('document_id', docId);

          await supabaseAdmin!.from('policy_documents').update({
            extraction_status: 'failed'
          }).eq('id', docId);
        }
      });

      // Process 3 tasks at a time to prevent OpenRouter rate limits
      await limit(3, tasks);
      console.log(`[Re-Extract] \u001b[32m🎉 Re-extraction complete!\u001b[39m`);
    })().catch(err => {
      console.error('[Re-Extract] Background processing thread crashed:', err);
    });

    return NextResponse.json({
      success: true,
      message: `Direct re-extraction triggered for ${docs.length} documents in the background. Check dev server console logs for real-time output.`,
    });
  } catch (error: any) {
    console.error('[Re-Extract] API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
