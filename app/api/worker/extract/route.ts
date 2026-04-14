/**
 * Extraction Worker - Process extraction queue in parallel
 * This endpoint should be called by a cron job or external scheduler
 * Processes multiple jobs concurrently (configurable max parallel jobs)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNextJob, completeJob, failJob, getQueueLength } from '@/lib/redis';
import { processExtractionJob } from '@/services/extraction';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

// Maximum number of concurrent extraction jobs
const MAX_PARALLEL_JOBS = parseInt(process.env.MAX_PARALLEL_EXTRACTIONS || '5', 10);

export async function GET(request: NextRequest) {
  try {
    // Verify authorization - check for secret token
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.EXTRACTION_WORKER_SECRET;

    if (!secretToken) {
      console.warn('[v0] EXTRACTION_WORKER_SECRET not configured');
      return NextResponse.json({ error: 'Worker not configured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${secretToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[v0] Starting extraction worker (max ${MAX_PARALLEL_JOBS} parallel jobs)...`);

    // Get current queue length
    const queueLength = await getQueueLength();
    console.log(`[v0] Queue length: ${queueLength} jobs pending`);

    // Determine how many jobs to process in parallel
    const jobsToProcess = Math.min(MAX_PARALLEL_JOBS, queueLength);

    if (jobsToProcess === 0) {
      return NextResponse.json(
        {
          success: true,
          jobsProcessed: 0,
          queueLength: 0,
          message: 'No jobs in queue',
        },
        { status: 200 }
      );
    }

    console.log(`[v0] Processing ${jobsToProcess} extraction jobs in parallel...`);

    // Create promises for parallel job processing
    const processingPromises = [];
    for (let i = 0; i < jobsToProcess; i++) {
      processingPromises.push(processExtractionJobSafely());
    }

    // Wait for all jobs to complete
    const results = await Promise.allSettled(processingPromises);

    // Count successes and failures
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failureCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success)).length;

    console.log(`[v0] Extraction worker completed: ${successCount} succeeded, ${failureCount} failed`);

    // Get updated queue length
    const updatedQueueLength = await getQueueLength();

    return NextResponse.json(
      {
        success: true,
        jobsProcessed: jobsToProcess,
        jobsSucceeded: successCount,
        jobsFailed: failureCount,
        queueLength: updatedQueueLength,
        results: results
          .filter(r => r.status === 'fulfilled')
          .map(r => (r as PromiseFulfilledResult<any>).value),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Extraction worker error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Worker error' },
      { status: 500 }
    );
  }
}

/**
 * Safely process a single extraction job
 * Handles errors and retries without crashing the worker
 */
async function processExtractionJobSafely() {
  let jobId = 'unknown';
  try {
    console.log('[v0] Starting extraction job processing...');
    const result = await processExtractionJob();
    
    if (!result) {
      console.log('[v0] No job available in queue');
      return {
        success: true,
        message: 'No job in queue',
        result: null,
      };
    }

    console.log('[v0] Extraction job completed successfully:', result?.jobId);
    return result || {
      success: true,
      message: 'Job processed',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[v0] Error processing extraction job ${jobId}:`, errorMessage);
    console.error('[v0] Full error:', error);
    
    return {
      success: false,
      error: errorMessage,
      jobId,
    };
  }
}
