/**
 * Debug Redis inspection - see raw queue and job data
 */

import { NextRequest, NextResponse } from 'next/server';
import redis from '@/lib/redis';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.EXTRACTION_WORKER_SECRET;

    if (secretToken && authHeader !== `Bearer ${secretToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get queue length
    const queueLength = await redis.llen('queue:extraction');
    console.log('[v0/debug] Queue length:', queueLength);

    // Get all job IDs in queue
    const jobIds = await redis.lrange('queue:extraction', 0, -1);
    console.log('[v0/debug] Job IDs in queue:', jobIds);

    // Get details for each job
    const jobDetails: any[] = [];
    for (const jobId of (jobIds || [])) {
      const jobKey = `job:${jobId}`;
      const jobData = await redis.get(jobKey);
      console.log(`[v0/debug] Job ${jobId}:`, jobData ? 'found' : 'not found');
      
      jobDetails.push({
        jobId,
        jobKey,
        hasData: !!jobData,
        data: jobData ? JSON.parse(jobData as string) : null,
      });
    }

    return NextResponse.json({
      queueLength,
      jobIds: jobIds || [],
      jobDetails,
      redisInfo: {
        url: process.env.UPSTASH_REDIS_REST_URL?.substring(0, 30) + '...',
        connected: true,
      },
    });
  } catch (error) {
    console.error('[v0/debug] Error inspecting Redis:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
