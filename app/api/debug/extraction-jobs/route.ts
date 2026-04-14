/**
 * Debug Extraction Jobs - Check status of all extraction jobs
 * Helps diagnose why extractions are stuck or failed
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getQueueLength } from '@/lib/redis';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Optional: verify authorization
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.EXTRACTION_WORKER_SECRET;

    if (secretToken && authHeader !== `Bearer ${secretToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all recent extraction jobs
    const { data: jobs, error: jobsError } = await supabaseAdmin!
      .from('extraction_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (jobsError) {
      throw jobsError;
    }

    // Get queue length
    const queueLength = await getQueueLength();

    // Group jobs by status
    const jobsByStatus = {
      queued: jobs?.filter(j => j.status === 'queued') || [],
      processing: jobs?.filter(j => j.status === 'processing') || [],
      completed: jobs?.filter(j => j.status === 'completed') || [],
      failed: jobs?.filter(j => j.status === 'failed') || [],
    };

    const summary = {
      totalJobs: jobs?.length || 0,
      queuedCount: jobsByStatus.queued.length,
      processingCount: jobsByStatus.processing.length,
      completedCount: jobsByStatus.completed.length,
      failedCount: jobsByStatus.failed.length,
      redisQueueLength: queueLength,
      issue: null as string | null,
    };

    // Detect issues
    if (jobsByStatus.processing.length > 0) {
      summary.issue = `⚠️ ${jobsByStatus.processing.length} jobs stuck in PROCESSING status - worker may have crashed`;
    } else if (jobsByStatus.queued.length > 0 && queueLength === 0) {
      summary.issue = '⚠️ Jobs in DB but not in Redis queue - Redis connection may be broken';
    } else if (jobsByStatus.queued.length > 5) {
      summary.issue = '⚠️ Large backlog - worker may not be running';
    } else if (jobsByStatus.failed.length > 2) {
      summary.issue = '⚠️ Multiple failed jobs - check API keys and network';
    }

    return NextResponse.json(
      {
        success: true,
        summary,
        jobs: {
          queued: jobsByStatus.queued.map(j => ({
            id: j.id,
            document_id: j.document_id,
            created_at: j.created_at,
          })),
          processing: jobsByStatus.processing.map(j => ({
            id: j.id,
            document_id: j.document_id,
            created_at: j.created_at,
            started_at: j.started_at,
          })),
          completed: jobsByStatus.completed.slice(0, 5).map(j => ({
            id: j.id,
            document_id: j.document_id,
            created_at: j.created_at,
            completed_at: j.completed_at,
          })),
          failed: jobsByStatus.failed.map(j => ({
            id: j.id,
            document_id: j.document_id,
            created_at: j.created_at,
            error_message: j.error_message,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Debug extraction jobs error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Debug error' },
      { status: 500 }
    );
  }
}
