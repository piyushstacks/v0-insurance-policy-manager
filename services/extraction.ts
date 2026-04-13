/**
 * Extraction Service
 * Orchestrates OCR jobs, manages extraction queue, and updates database
 */

import { supabaseAdmin } from '@/lib/supabase';
import { ocrProvider } from './ocr-provider';
import redis, { enqueueExtractionJob, getNextJob, completeJob, failJob } from '@/lib/redis';
import { ExtractionResult } from '@/lib/schemas';

/**
 * Queue a document for extraction
 * Called when user uploads a new policy document
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
          job_id: jobId
        },
      ])
      .select('id')
      .single();

    if (jobError) throw jobError;
    const realJobId = extData.id;

    // Add to queue using the database UUID
    await enqueueExtractionJob(realJobId, documentId, userId, fileUrl);

    return { success: true, jobId: realJobId };
  } catch (error) {
    console.error('Failed to queue extraction job:', error);
    throw error;
  }
}

/**
 * Inline extraction - runs OCR immediately during upload request.
 * No Redis/cron needed. Updates the policy row with real extracted data.
 */
export async function extractDocumentInline(
  documentId: string,
  policyId: string,
  fileUrl: string
) {
  console.log(`[v0/inline] Starting inline extraction for doc ${documentId}`);

  // Record extraction job
  const { data: jobRow } = await supabaseAdmin!
    .from('extraction_jobs')
    .insert([{ document_id: documentId, status: 'processing', job_id: `inline-${documentId}` }])
    .select('id')
    .single();

  const jobDbId = jobRow?.id;

  try {
    // Run OCR
    const rawText = await ocrProvider.extractText(fileUrl);
    const extracted = await ocrProvider.extractStructuredData(rawText);

    console.log('[v0/inline] Extraction result:', extracted);

    // Update the policy row with real data
    const safeDate = (d: string | undefined, fallback: Date) => {
      if (!d) return fallback.toISOString();
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
    };

    const startDate = safeDate(extracted.coverage_start, new Date());
    const expiryDate = safeDate(extracted.coverage_end, new Date(Date.now() + 31536000000));

    let finalCustId;
    let finalInsId;

    if (extracted.customer_name && extracted.customer_name !== 'Unknown Customer') {
      const { data: custExt } = await supabaseAdmin!
        .from('customers')
        .select('id')
        .eq('name', extracted.customer_name)
        .limit(1)
        .maybeSingle();

      if (custExt) {
        finalCustId = custExt.id;
      } else {
        const { data: custNew } = await supabaseAdmin!
          .from('customers')
          .insert([{ name: extracted.customer_name, email: 'auto@ocr.local' }])
          .select('id')
          .single();
        if (custNew) finalCustId = custNew.id;
      }
    }

    if (extracted.insurer_name && extracted.insurer_name !== 'Unknown Insurer') {
      const { data: insExt } = await supabaseAdmin!
        .from('insurers')
        .select('id')
        .eq('name', extracted.insurer_name)
        .limit(1)
        .maybeSingle();

      if (insExt) {
        finalInsId = insExt.id;
      } else {
        const { data: insNew } = await supabaseAdmin!
          .from('insurers')
          .insert([{ name: extracted.insurer_name }])
          .select('id')
          .single();
        if (insNew) finalInsId = insNew.id;
      }
    }

    const updatePayload: any = {
      policy_number: extracted.policy_number || `OCR-${Date.now()}`,
      policy_type:   extracted.policy_type   || 'General Insurance',
      start_date:    startDate,
      expiry_date:   expiryDate,
      premium_amount: extracted.premium_amount || 1,
    };

    if (finalCustId) updatePayload.customer_id = finalCustId;
    if (finalInsId) updatePayload.insurer_id = finalInsId;

    await supabaseAdmin!
      .from('policies')
      .update(updatePayload)
      .eq('id', policyId);

    // Mark document as extracted
    await supabaseAdmin!
      .from('policy_documents')
      .update({ extraction_status: 'extracted', raw_ocr_text: rawText.substring(0, 5000) })
      .eq('id', documentId);

    // Mark job as completed
    if (jobDbId) {
      await supabaseAdmin!
        .from('extraction_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', jobDbId);
    }

    console.log(`[v0/inline] Extraction complete for policy ${policyId}`);
    return { success: true, extracted };
  } catch (err: any) {
    console.error('[v0/inline] Extraction failed:', err);
    if (jobDbId) {
      await supabaseAdmin!
        .from('extraction_jobs')
        .update({ status: 'failed', error_message: err.message })
        .eq('id', jobDbId);
    }
    // Don't throw — upload itself succeeded, extraction is best-effort
    return { success: false, error: err.message };
  }
}

/**
 * Worker function - processes extraction jobs
 * Should be called by a background worker or cron job
 * For development, can be called from an API route
 */
export async function processExtractionJob() {
  const job = await getNextJob();
  if (!job) return null;

  const jobId = job.id;
  const { documentId, userId, fileUrl } = job.payload;

  try {
    // Mark job as processing
    await supabaseAdmin!
      .from('extraction_jobs')
      .update({ status: 'processing' })
      .eq('id', jobId);

    console.log(`[v0] Processing extraction job ${jobId}`);

    // Extract text from document
    const extractedText = await ocrProvider.extractText(fileUrl);

    // Parse into structured data
    const structuredData = await ocrProvider.extractStructuredData(extractedText);

    // Update job with results
    await supabaseAdmin!
      .from('extraction_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Fetch the policy ID for this document
    const { data: docData } = await supabaseAdmin!
        .from('policy_documents')
        .update({ extraction_status: 'extracted' })
        .eq('id', documentId)
        .select('policy_id')
        .single();
        
    // Write OCR Output back to the DB to overwrite the placeholder
    if (docData?.policy_id) {
        await supabaseAdmin!
           .from('policies')
           .update({
               policy_number: structuredData.policy_number || `OCR_UNKNOWN_${Date.now()}`,
               policy_type: structuredData.policy_type || 'Unknown Type',
               start_date: structuredData.coverage_start ? new Date(structuredData.coverage_start).toISOString() : new Date().toISOString(),
               expiry_date: structuredData.coverage_end ? new Date(structuredData.coverage_end).toISOString() : new Date(Date.now() + 31536000000).toISOString(),
               premium_amount: structuredData.premium_amount || 1,
               status: 'active'
           })
           .eq('id', docData.policy_id);
    }
    
    // Mark job as complete in queue
    await completeJob(jobId, structuredData);

    console.log(`[v0] Extraction job ${jobId} completed successfully`);

    return {
      success: true,
      jobId,
      data: structuredData,
    };
  } catch (error) {
    console.error(`[v0] Extraction job ${jobId} failed:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update job with error
    await supabaseAdmin!
      .from('extraction_jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', jobId);

    // Handle retry logic
    await failJob(jobId, errorMessage);

    throw error;
  }
}

/**
 * Get extraction job status
 */
export async function getExtractionStatus(jobId: string) {
  const { data, error } = await supabaseAdmin!
    .from('extraction_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Batch process all pending extraction jobs
 * Useful for cron jobs or background workers
 */
export async function processPendingExtractions() {
  const results = [];

  while (true) {
    try {
      const result = await processExtractionJob();
      if (!result) break;
      results.push(result);
    } catch (error) {
      console.error('Error processing extraction batch:', error);
      break;
    }
  }

  return results;
}
