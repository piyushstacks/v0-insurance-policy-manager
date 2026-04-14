/**
 * Extraction Worker - Process extraction queue one-by-one
 * This endpoint should be called by a cron job or external scheduler
 * Example: Call this every 10 seconds to continuously process the queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { processPendingExtractions } from '@/services/extraction';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

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

    console.log('[v0] Starting extraction worker...');

    // Process all pending extractions in queue (one-by-one)
    const results = await processPendingExtractions();

    console.log(`[v0] Extraction worker completed. Processed ${results.length} jobs.`);

    return NextResponse.json(
      {
        success: true,
        jobsProcessed: results.length,
        results,
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
