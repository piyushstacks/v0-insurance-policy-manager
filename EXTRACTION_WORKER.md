# Background Extraction Worker Setup Guide

## Overview

The Insurance Policy Manager now uses a **background extraction queue** for processing policy documents. This means:

✅ **Bulk uploads all files at once** - No sequential waiting on frontend  
✅ **Extracts one-by-one in background** - Independent of user session  
✅ **Automatic real-time updates** - Supabase Realtime notifies when extraction completes  
✅ **No app dependency** - Extraction continues even if user closes app  

## Architecture

```
User Uploads Files
        ↓
All Files Uploaded (Parallel)
        ↓
Each File → Redis Queue
        ↓
Background Worker Processes Queue (One-by-One)
        ↓
Extract Data via AI Service
        ↓
Update Policy in Supabase
        ↓
Realtime Alert → Auto-refresh in Policies List
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
```

Generate a secure token:
```bash
openssl rand -hex 32
```

### 2. Configure Extraction Worker

The extraction worker is available at: `POST /api/worker/extract`

**Request:**
```bash
curl -X GET "https://your-domain.com/api/worker/extract" \
  -H "Authorization: Bearer YOUR_EXTRACTION_WORKER_SECRET"
```

**Response:**
```json
{
  "success": true,
  "jobsProcessed": 3,
  "results": [
    {
      "success": true,
      "jobId": "job-uuid",
      "data": { ... extracted data ... }
    }
  ]
}
```

### 3. Setup Cron Job (Continuous Processing)

**Option A: Using EasyCron (Free)**

1. Go to [easycron.com](https://www.easycron.com/)
2. Create new cron job
3. URL: `https://your-domain.com/api/worker/extract`
4. Method: `GET`
5. Custom Headers:
   - `Authorization: Bearer YOUR_EXTRACTION_WORKER_SECRET`
6. Schedule: `*/10 * * * *` (every 10 seconds)

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
   - Schedule: `rate(10 seconds)`
   - Target: Lambda function

**Option C: Using Vercel Crons (For Vercel Deployment)**

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/worker/extract",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

Set environment variable in Vercel dashboard:
```
EXTRACTION_WORKER_SECRET=your-token
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

1. User adds files to bulk uploader
2. Clicks "Upload" button
3. **All files upload in parallel** to storage
4. Policy records created for each file
5. Each file **queued in Redis** for extraction
6. Upload response returns immediately
7. **No waiting for extraction**

### Extraction Flow

1. Worker calls `/api/worker/extract` (every 10 seconds)
2. Gets next job from Redis queue
3. Fetches document from storage
4. Runs OCR/AI extraction
5. Updates policy with extracted data
6. Sends Realtime update to Supabase
7. Polls processes next job

### User Experience

1. User uploads 10 files
2. **All 10 upload in ~2-5 seconds**
3. User sees "Queued for extraction" status
4. Can close app immediately
5. Extraction happens in background
6. When extraction completes:
   - Policy automatically updates in Supabase
   - Realtime notification sent
   - Policies list updates for any user viewing it
7. User sees extracted data without refresh

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

- **Concurrent uploads**: Limited by browser (typically 6 parallel)
- **Sequential extraction**: One file at a time from queue
- **Extraction time**: 10-60 seconds per document (depending on size)
- **Recommended cron frequency**: Every 10 seconds
- **Max workers**: Run multiple worker instances for faster processing

## Scaling to Multiple Workers

If you want **parallel extraction** instead of sequential:

1. Run multiple worker instances:
```bash
# Worker 1
curl /api/worker/extract?instanceId=1
# Worker 2  
curl /api/worker/extract?instanceId=2
# Worker 3
curl /api/worker/extract?instanceId=3
```

2. Each gets independent queue: `queue:extraction:instance:1`, etc.

3. Update worker logic to use instance-specific queues

## API Reference

### POST /api/worker/extract

Process next extraction job from queue.

**Headers:**
```
Authorization: Bearer YOUR_EXTRACTION_WORKER_SECRET
```

**Success Response (200):**
```json
{
  "success": true,
  "jobsProcessed": 1,
  "results": [
    {
      "success": true,
      "jobId": "extraction-abc123",
      "data": {
        "customer_name": "John Doe",
        "policy_number": "POL123456",
        ...
      }
    }
  ]
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
2. ✅ Configure Redis (UPSTASH_REDIS_*) 
3. ✅ Set up cron job to call `/api/worker/extract` every 10 seconds
4. ✅ Test with bulk upload
5. ✅ Monitor queue length and extraction jobs
6. ✅ Adjust cron frequency if needed

## Support

For issues or questions:
- Check database: `extraction_jobs` table for job status
- Review logs: Check worker output for error messages
- Verify Redis: Use `redis-cli` to inspect queue
