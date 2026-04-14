# Background Extraction Worker Setup Guide

## Overview

The Insurance Policy Manager now uses a **background extraction queue** for processing policy documents. This means:

✅ **User uploads files and closes app** - No need to wait  
✅ **All extractions happen in parallel** - Configurable concurrency  
✅ **Automatic real-time updates** - Supabase Realtime notifies when extraction completes  
✅ **No user session dependency** - Extraction continues in background  

## Architecture

```
User Uploads Multiple Files
        ↓
All Files Uploaded (Parallel)
        ↓
Each File → Redis Queue
        ↓
User CLOSES APP (doesn't matter!)
        ↓
Background Worker Processes Multiple Jobs (Parallel)
        ↓
Job 1: Extract via AI      Job 2: Extract via AI      Job 3: Extract via AI
        ↓                          ↓                          ↓
    Update Policy 1          Update Policy 2          Update Policy 3
        ↓                          ↓                          ↓
    Realtime Alert 1          Realtime Alert 2          Realtime Alert 3
        ↓                          ↓                          ↓
Auto-Update in Policies List (for any connected users)
```

## Setup Instructions

### 1. Environment Variables

Add these to your `.env.local`:

```bash
# Redis Queue Configuration
UPSTASH_REDIS_REST_URL=https://your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Worker Secret (for authentication)
EXTRACTION_WORKER_SECRET=your-secure-random-token-here

# Max parallel extraction jobs (default: 5)
# Increase based on your AI API rate limits and server capacity
# For light testing: 2-3
# For production: 5-10
# For high-volume: 10-20+
MAX_PARALLEL_EXTRACTIONS=5
```

Generate a secure token:
```bash
openssl rand -hex 32
```

### 2. Configure Extraction Worker

The extraction worker is available at: `GET /api/worker/extract`

**Request:**
```bash
curl -X GET "https://your-domain.com/api/worker/extract" \
  -H "Authorization: Bearer YOUR_EXTRACTION_WORKER_SECRET"
```

**Response:**
```json
{
  "success": true,
  "jobsProcessed": 5,
  "jobsSucceeded": 5,
  "jobsFailed": 0,
  "queueLength": 3,
  "results": [
    {
      "success": true,
      "jobId": "extraction-uuid-1",
      "data": { ... extracted data ... }
    },
    ...
  ]
}
```

**Cron Frequency Recommendation:**

The worker processes **all available jobs up to MAX_PARALLEL_EXTRACTIONS** in each call.

- Call every **30 seconds** for continuous processing
- Or every **1 minute** if you want less frequent checks
- Or every **5 minutes** for low-volume scenarios

Example: If you have 20 jobs queued and MAX_PARALLEL_EXTRACTIONS=5:
- Call 1 (T=30s): Processes 5 jobs → 15 remaining
- Call 2 (T=60s): Processes 5 jobs → 10 remaining  
- Call 3 (T=90s): Processes 5 jobs → 5 remaining
- Call 4 (T=120s): Processes 5 jobs → 0 remaining

### 3. Setup Cron Job (Continuous Processing)

**Option A: Using EasyCron (Free)**

1. Go to [easycron.com](https://www.easycron.com/)
2. Create new cron job
3. URL: `https://your-domain.com/api/worker/extract`
4. Method: `GET`
5. Custom Headers:
   - `Authorization: Bearer YOUR_EXTRACTION_WORKER_SECRET`
6. Schedule: `*/30 * * * * *` (every 30 seconds)
   - Or `*/1 * * * *` (every 1 minute) for less frequent checks

**Option B: Using AWS Lambda + EventBridge**

1. Create Lambda function:
```python
import requests
import os

def lambda_handler(event, context):
    token = os.environ['EXTRACTION_WORKER_SECRET']
    url = os.environ['APP_URL'] + '/api/worker/extract'
    
    response = requests.get(
        url,
        headers={'Authorization': f'Bearer {token}'}
    )
    
    return {
        'statusCode': response.status_code,
        'body': response.json()
    }
```

2. Set up EventBridge rule:
   - Schedule: `rate(30 seconds)`
   - Target: Lambda function

**Option C: Using Vercel Crons (For Vercel Deployment)**

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/worker/extract",
      "schedule": "*/30 * * * * *"
    }
  ]
}
```

Set environment variables in Vercel dashboard:
```
EXTRACTION_WORKER_SECRET=your-token
MAX_PARALLEL_EXTRACTIONS=5
```

### 4. Queue Status Monitoring

Check queue length anytime:
```typescript
import { getQueueLength } from '@/lib/redis';

const pendingJobs = await getQueueLength();
console.log(`Jobs in queue: ${pendingJobs}`);
```

## How It Works

### Upload Flow

1. User adds 10 files to bulk uploader
2. Clicks "Upload" button
3. **All 10 files upload in parallel** to storage (2-5 seconds)
4. Policy records created for each file
5. Each file **added to Redis queue** for extraction
6. Upload response returns **immediately**
7. **User can close app now** - extraction happens independently

### Extraction Flow

1. Cron job calls `/api/worker/extract` every 30 seconds
2. Worker fetches up to `MAX_PARALLEL_EXTRACTIONS` jobs (default: 5)
3. **All 5 jobs run in parallel**:
   - Job 1: Extract PDF document via OpenRouter
   - Job 2: Extract PDF document via Gemini
   - Job 3: Extract PDF document via OpenRouter
   - Job 4: Extract PDF document via Gemini
   - Job 5: Extract PDF document via OpenRouter
4. Each job updates its policy with extracted data
5. Each sends Realtime notification to Supabase
6. Next batch of 5 jobs starts immediately
7. Process continues until queue is empty

### User Experience

**Scenario: User uploads 10 files**

1. **T=0s**: User drags 10 PDFs to uploader
2. **T=2s**: All uploaded, queued for extraction
3. **T=5s**: **User closes app** (doesn't matter!)
4. **T=30s**: Worker starts processing (first 5 jobs in parallel)
5. **T=60s**: First 5 jobs done, policies updated
6. **T=90s**: Next 5 jobs start
7. **T=120s**: All 10 extractions complete
8. **T=130s**: User reopens app
9. **✅ Sees all 10 policies with extracted data** (via Realtime sync)

## Monitoring & Debugging

### Check Recent Extractions
```typescript
// In any API route or server component
import { getExtractionStatus } from '@/services/extraction';

const status = await getExtractionStatus('job-id');
console.log(status);
// { status: 'completed', extracted_data: {...} }
```

### View Queue
```typescript
import { getQueueLength } from '@/lib/redis';

const count = await getQueueLength();
console.log(`Queue length: ${count}`);
```

### Check Job Details
```typescript
import redis from '@/lib/redis';

const jobData = await redis.get(`job:job-id`);
console.log(JSON.parse(jobData));
```

## Troubleshooting

### "Worker not configured" Error
- Ensure `EXTRACTION_WORKER_SECRET` is set
- Check `.env.local` has correct value

### "Unauthorized" Error  
- Verify `Authorization: Bearer` header is correct
- Token must match `EXTRACTION_WORKER_SECRET`

### Extraction Stuck in Queue
- Verify cron job is running
- Check cron execution logs
- Manually trigger: `curl -X GET "http://localhost:3000/api/worker/extract" -H "Authorization: Bearer your-token"`

### Files Not Extracting
- Check extraction job status in database
- Look for error_message in extraction_jobs table
- Verify OpenRouter/Gemini API keys are valid
- Check Redis connection: `UPSTASH_REDIS_REST_URL`

## Performance Notes

- **Concurrent uploads**: Limited by browser (typically 6-10 parallel)
- **Parallel extraction**: Multiple files at once (configurable: 5-20)
- **Extraction time**: 10-60 seconds per document (depending on size)
- **Recommended cron frequency**: Every 30 seconds
- **Throughput**: With MAX_PARALLEL_EXTRACTIONS=5 and 30-40 second extraction time:
  - ~7-10 documents per minute
  - ~400-600 documents per hour
  - ~10,000 documents per day

## Tuning MAX_PARALLEL_EXTRACTIONS

Choose based on your setup:

| Environment | Setting | Notes |
|------------|---------|-------|
| **Development** | 2-3 | Avoid rate limiting while testing |
| **Small Deployment** | 5 | Default, balanced for most use cases |
| **Medium Deployment** | 10 | Good for steady 100-200 docs/day |
| **Large Deployment** | 15-20 | For high-volume scenarios |
| **Enterprise** | 30+ | With multi-instance setup and pooling |

⚠️ **Consider:**
- OpenRouter/Gemini API rate limits
- Server CPU and memory
- Database connection pool size
- Network bandwidth

**Monitor queue length:**
```bash
# Check how many jobs are pending
curl -X GET "https://your-domain.com/api/worker/extract" \
  -H "Authorization: Bearer YOUR_EXTRACTION_WORKER_SECRET" \
  | jq '.queueLength'
```

If queue keeps growing, increase MAX_PARALLEL_EXTRACTIONS.

## API Reference

### GET /api/worker/extract

Process extraction jobs from queue (parallel).

**Headers:**
```
Authorization: Bearer YOUR_EXTRACTION_WORKER_SECRET
```

**Success Response (200):**
```json
{
  "success": true,
  "jobsProcessed": 5,
  "jobsSucceeded": 5,
  "jobsFailed": 0,
  "queueLength": 15,
  "results": [
    {
      "success": true,
      "jobId": "extraction-abc123",
      "data": {
        "customer_name": "John Doe",
        "policy_number": "POL123456",
        "policy_type": "Motor Insurance",
        ...
      }
    },
    ...
  ]
}
```

**Empty Queue Response (200):**
```json
{
  "success": true,
  "jobsProcessed": 0,
  "queueLength": 0,
  "message": "No jobs in queue"
}
```

**Error Response (500):**
```json
{
  "error": "Error message describing what went wrong"
}
```

## Next Steps

1. ✅ Set `EXTRACTION_WORKER_SECRET`
2. ✅ Configure `MAX_PARALLEL_EXTRACTIONS` (start with 5)
3. ✅ Configure Redis (UPSTASH_REDIS_*) 
4. ✅ Set up cron job to call `/api/worker/extract` every 30 seconds
5. ✅ Test with bulk upload (5+ files)
6. ✅ Monitor queue length: increases during upload, decreases during extraction
7. ✅ Adjust MAX_PARALLEL_EXTRACTIONS if queue keeps growing
8. ✅ Verify Realtime subscriptions update policies in real-time

## Quick Test

```bash
# 1. Set token
export TOKEN="your-extraction-worker-secret"

# 2. Call worker manually (see what happens)
curl -X GET "http://localhost:3000/api/worker/extract" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Output should show:
# - jobsProcessed: how many jobs were processed
# - jobsSucceeded: number of successful extractions
# - jobsFailed: number of failed extractions
# - queueLength: how many jobs remain

# 3. Upload files and watch extraction happen
# Open http://localhost:3000/app/policies/upload
# Upload 10 PDFs
# Call worker endpoint multiple times
# See queue length decrease as jobs are processed
```

## Support

For issues or questions:
- Check database: `extraction_jobs` table for job status
- Review logs: Check worker output for error messages
- Verify Redis: Use `redis-cli` to inspect queue
