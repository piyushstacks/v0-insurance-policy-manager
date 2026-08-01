import { Redis } from '@upstash/redis';
import { supabaseAdmin } from './supabase';
import { sendEmail } from '@/services/email';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn('Upstash Redis credentials not configured');
}

export default redis;

// Job queue utilities
export interface JobData {
  id: string;
  type: string;
  payload: any;
  attempts?: number;
  maxRetries?: number;
  createdAt: number;
}

const QUEUE_PREFIX = 'queue:';
const JOB_PREFIX = 'job:';
const MAX_RETRIES = 3;

/**
 * Enqueue a new extraction job
 */
export async function enqueueExtractionJob(
  jobId: string,
  documentId: string,
  userId: string,
  fileUrl: string
) {
  const jobData: JobData = {
    id: jobId,
    type: 'extract-document',
    payload: {
      documentId,
      userId,
      fileUrl,
    },
    attempts: 0,
    maxRetries: MAX_RETRIES,
    createdAt: Date.now(),
  };

  console.log('[v0/redis] Enqueueing job:', jobId);

  // Store job details
  const jobKey = `${JOB_PREFIX}${jobId}`;
  console.log('[v0/redis] Storing job data with key:', jobKey);
  await redis.set(jobKey, JSON.stringify(jobData), {
    ex: 86400, // 24 hour expiry
  });
  console.log('[v0/redis] Job data stored');

  // Add to queue
  const queueKey = `${QUEUE_PREFIX}extraction`;
  console.log('[v0/redis] Adding to queue:', queueKey);
  await redis.lpush(queueKey, jobId);
  console.log('[v0/redis] Job added to queue');

  return jobData;
}

/**
 * Get next job from queue
 */
export async function getNextJob() {
  console.log('[v0/redis] Getting next job from queue...');
  
  const jobId = await redis.rpop(`${QUEUE_PREFIX}extraction`);
  console.log('[v0/redis] rpop returned jobId:', jobId);
  
  if (!jobId) {
    console.log('[v0/redis] No jobId in queue');
    return null;
  }

  const jobKey = `${JOB_PREFIX}${jobId}`;
  console.log('[v0/redis] Looking for job data with key:', jobKey);
  
  const jobData = await redis.get(jobKey);
  console.log('[v0/redis] Job data from redis:', jobData ? 'found' : 'not found');
  
  if (!jobData) {
    // Job ID was popped from the queue but its Redis key has expired (24h TTL) or
    // was never written.  We cannot recover the original payload from Redis alone.
    // The corresponding row in the Supabase extraction_jobs table will remain in
    // 'queued' status — an admin can re-trigger via POST /api/extract/process.
    console.error(
      `[v0/redis] 🔴 ORPHANED JOB — job ID "${jobId}" was popped from queue:extraction ` +
      `but key "${jobKey}" does not exist in Redis (likely TTL-expired). ` +
      `Action required: check Supabase extraction_jobs for job_id = "${jobId}" ` +
      `and re-trigger extraction manually via POST /api/extract/process.`
    );
    return null;
  }

  const parsed = JSON.parse(jobData as string) as JobData;
  console.log('[v0/redis] Parsed job:', parsed.id, 'type:', parsed.type);
  
  return parsed;
}

/**
 * Mark job as completed
 */
export async function completeJob(jobId: string, result: any) {
  await redis.del(`${JOB_PREFIX}${jobId}`);
  // Could log to database for audit
}

/**
 * Mark job as failed
 */
export async function failJob(jobId: string, error: string) {
  const jobData = await redis.get(`${JOB_PREFIX}${jobId}`);
  if (!jobData) return;

  const job = JSON.parse(jobData as string) as JobData;
  job.attempts = (job.attempts || 0) + 1;

  if (job.attempts && job.maxRetries && job.attempts < job.maxRetries) {
    // Retry - put back in queue
    await redis.set(`${JOB_PREFIX}${jobId}`, JSON.stringify(job), {
      ex: 86400,
    });
    await redis.lpush(`${QUEUE_PREFIX}extraction`, jobId);
  } else {
    // Too many retries, delete from queue and fail permanently
    await redis.del(`${JOB_PREFIX}${jobId}`);
    
    if (supabaseAdmin) {
      await supabaseAdmin.from('extraction_jobs').update({
        status: 'failed_permanently',
        error_message: error
      }).eq('job_id', jobId);

      // Send email notification to admin or specific recipient
      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: '🚨 PolicyVault Extraction Job Failed Permanently',
          html: `<p>An extraction job has permanently failed after max retries.</p>
                 <p><strong>Job ID:</strong> ${jobId}</p>
                 <p><strong>Document ID:</strong> ${job.payload?.documentId || 'Unknown'}</p>
                 <p><strong>User ID:</strong> ${job.payload?.userId || 'Unknown'}</p>
                 <p><strong>Error:</strong> ${error}</p>
                 <p>Please check the PolicyVault dashboard or Supabase logs for more details.</p>`
        });
      }
    }
  }
}

/**
 * Get queue length
 */
export async function getQueueLength() {
  return await redis.llen(`${QUEUE_PREFIX}extraction`);
}
