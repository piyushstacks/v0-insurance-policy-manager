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
    const { error: jobError } = await supabaseAdmin!
      .from('extraction_jobs')
      .insert([
        {
          id: jobId,
          user_id: userId,
          document_id: documentId,
          status: 'pending',
        },
      ]);

    if (jobError) throw jobError;

    // Add to queue
    await enqueueExtractionJob(jobId, documentId, userId, fileUrl);

    return { success: true, jobId };
  } catch (error) {
    console.error('Failed to queue extraction job:', error);
    throw error;
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
        extracted_data: structuredData,
      })
      .eq('id', jobId);

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
