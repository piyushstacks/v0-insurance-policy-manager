import { Redis } from '@upstash/redis';

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

  // Store job details
  await redis.set(`${JOB_PREFIX}${jobId}`, JSON.stringify(jobData), {
    ex: 86400, // 24 hour expiry
  });

  // Add to queue
  await redis.lpush(`${QUEUE_PREFIX}extraction`, jobId);

  return jobData;
}

/**
 * Get next job from queue
 */
export async function getNextJob() {
  const jobId = await redis.rpop(`${QUEUE_PREFIX}extraction`);
  if (!jobId) return null;

  const jobData = await redis.get(`${JOB_PREFIX}${jobId}`);
  if (!jobData) return null;

  return JSON.parse(jobData as string) as JobData;
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
    // Too many retries, delete
    await redis.del(`${JOB_PREFIX}${jobId}`);
    // Could log failure to database for monitoring
  }
}

/**
 * Get queue length
 */
export async function getQueueLength() {
  return await redis.llen(`${QUEUE_PREFIX}extraction`);
}
