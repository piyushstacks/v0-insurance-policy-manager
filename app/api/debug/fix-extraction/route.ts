/**
 * Fix Extraction Issues - Manually retry failed/stuck jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { enqueueExtractionJob } from '@/lib/redis';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.EXTRACTION_WORKER_SECRET;

    if (!secretToken) {
      return NextResponse.json({ error: 'Worker not configured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${secretToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();

    if (action === 'reset-processing') {
      // Reset jobs stuck in processing status back to queued
      const { data: jobs, error: selectError } = await supabaseAdmin!
        .from('extraction_jobs')
        .select('*')
        .eq('status', 'processing');

      if (selectError) throw selectError;

      const processingJobs = jobs || [];
      
      if (processingJobs.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No jobs stuck in processing',
          resetCount: 0,
        });
      }

      // Reset them back to queued
      const { error: updateError } = await supabaseAdmin!
        .from('extraction_jobs')
        .update({ status: 'queued' })
        .eq('status', 'processing');

      if (updateError) throw updateError;

      // Re-add to Redis queue
      let requeuedCount = 0;
      for (const job of processingJobs) {
        try {
          // Try to re-queue - note: this requires document info which we don't have here
          // So we just reset the status and let the next worker pick it up
          requeuedCount++;
        } catch (err) {
          console.error('Failed to requeue job:', err);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Reset ${processingJobs.length} jobs from processing → queued`,
        resetCount: processingJobs.length,
      });
    }

    if (action === 'retry-failed') {
      // Get failed jobs
      const { data: failedJobs, error: selectError } = await supabaseAdmin!
        .from('extraction_jobs')
        .select('id, document_id, policy_id: policy_documents(policy_id)')
        .eq('status', 'failed')
        .limit(10);

      if (selectError) throw selectError;

      const jobs = failedJobs || [];

      if (jobs.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No failed jobs to retry',
          retryCount: 0,
        });
      }

      // Reset to queued
      const jobIds = jobs.map(j => j.id);
      const { error: updateError } = await supabaseAdmin!
        .from('extraction_jobs')
        .update({ status: 'queued', error_message: null })
        .in('id', jobIds);

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: `Reset ${jobs.length} failed jobs to queued status`,
        retryCount: jobs.length,
      });
    }

    if (action === 'clear-errors') {
      // Show all errors
      const { data: failedJobs, error: selectError } = await supabaseAdmin!
        .from('extraction_jobs')
        .select('id, document_id, status, error_message')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(20);

      if (selectError) throw selectError;

      return NextResponse.json({
        success: true,
        failedJobs: failedJobs || [],
      });
    }

    return NextResponse.json(
      { error: 'Unknown action. Use: reset-processing, retry-failed, or clear-errors' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[v0] Fix extraction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fix error' },
      { status: 500 }
    );
  }
}
