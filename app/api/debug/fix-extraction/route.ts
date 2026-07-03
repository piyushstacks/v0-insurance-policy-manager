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

    if (action === 're-extract-all') {
      // 1. Fetch all documents
      const { data: docs, error: selectError } = await supabaseAdmin!
        .from('policy_documents')
        .select('id, file_path, policy_id, policies(user_id)');

      if (selectError) throw selectError;

      if (!docs || docs.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No policy documents found to re-extract.',
          enqueuedCount: 0,
        });
      }

      // Helper to generate public B2 URL
      const getB2PublicUrl = (fileName: string) => {
        const b2Bucket = process.env.B2_BUCKET_NAME || '';
        const b2PublicUrl = process.env.NEXT_PUBLIC_B2_PUBLIC_URL || '';
        if (b2PublicUrl) {
          const baseUrl = b2PublicUrl.endsWith('/') ? b2PublicUrl.slice(0, -1) : b2PublicUrl;
          return `${baseUrl}/${fileName}`;
        }
        return `https://f000.backblazeb2.com/file/${b2Bucket}/${fileName}`;
      };

      let enqueuedCount = 0;
      for (const doc of docs) {
        if (!doc.file_path) continue;

        const fileUrl = getB2PublicUrl(doc.file_path);
        const policyUserId = (doc.policies as any)?.user_id || 'system';
        const jobId = `extraction-${doc.id}`;

        // Reset document status to pending
        await supabaseAdmin!
          .from('policy_documents')
          .update({ extraction_status: 'pending' })
          .eq('id', doc.id);

        // Delete any existing job for this document
        await supabaseAdmin!
          .from('extraction_jobs')
          .delete()
          .eq('document_id', doc.id);

        // Create new queued job record
        const { data: jobRow } = await supabaseAdmin!
          .from('extraction_jobs')
          .insert([
            {
              document_id: doc.id,
              status: 'queued',
              job_id: jobId,
            },
          ])
          .select('id')
          .single();

        if (jobRow) {
          // Push job onto Upstash Redis queue
          await enqueueExtractionJob(jobRow.id, doc.id, policyUserId, fileUrl);
          enqueuedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Successfully reset and enqueued ${enqueuedCount} documents for re-extraction.`,
        enqueuedCount,
      });
    }

    return NextResponse.json(
      { error: 'Unknown action. Use: reset-processing, retry-failed, clear-errors, or re-extract-all' },
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
