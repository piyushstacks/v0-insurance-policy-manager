import { NextRequest, NextResponse } from 'next/server';
import { processBulkExtractions } from '@/services/extraction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/extract/process
 * Worker endpoint to process pending extraction jobs
 * 
 * Security: Protected by verifying CRON_SECRET header
 * Can be triggered by:
 * - Vercel Cron Jobs
 * - Manual API calls with correct secret
 * - Background worker services
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[v0] Starting extraction batch processing');

    // Process all pending jobs
    const results = await processBulkExtractions();

    console.log(`[v0] Processed ${results.length} extraction jobs`);

    return NextResponse.json(
      {
        success: true,
        processed: results.length,
        jobs: results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Extraction worker error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      },
      { status: 500 }
    );
  }
}
