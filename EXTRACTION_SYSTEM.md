# Bulk PDF Extraction System - Complete Guide

## System Overview

This document describes the complete PDF extraction system implementation, including bulk upload, background job processing, and extraction results.

## Architecture

```
┌─────────────────┐
│  Frontend Upload │
│   (Browser)      │
└────────┬─────────┘
         │ POST /api/upload (multiple files)
         ↓
┌─────────────────────────────────┐
│   File Upload API                │
│   - Store files in storage       │
│   - Create document records      │
│   - Queue extraction jobs        │
└────────┬────────────────────────┘
         │ enqueueExtractionJob()
         ↓
┌─────────────────────────────────┐
│   Redis Queue                    │
│   (Upstash Redis)               │
│   - Queue: queue:extraction      │
│   - Jobs: job:xxxxx             │
└────────┬────────────────────────┘
         │ getNextJob()
         ↓
┌─────────────────────────────────┐
│   Extraction Worker              │
│   /api/worker/extract            │
│   - Process jobs in parallel     │
│   - MAX_PARALLEL_EXTRACTIONS=5  │
└────────┬────────────────────────┘
         │ processExtractionJob()
         ↓
┌─────────────────────────────────┐
│   OCR Providers                  │
│   1. Google Document AI          │
│   2. OpenRouter (Free Models)   │
│   3. Gemini API (Fallback)      │
└────────┬────────────────────────┘
         │ extractText() + structuredData()
         ↓
┌─────────────────────────────────┐
│   Database Updates               │
│   1. extraction_jobs (completed) │
│   2. policy_documents (extracted)│
│   3. policies (populated)        │
└─────────────────────────────────┘
```

## File Paths

### API Routes

```
/app/api/
├── upload/                          # File upload endpoint
│   ├── route.ts                     # Handles bulk uploads
│   └── [id]/                        # Document management
│
├── worker/extract/
│   └── route.ts                     # Background extraction worker
│
└── debug/                           # Development/debugging
    ├── extraction-jobs/             # Job status overview
    ├── job-details/                 # Full job records
    ├── redis-inspect/               # Redis queue inspection
    ├── fix-extraction/              # Manual job recovery
    └── migrate/                     # Database migration help
```

### Services

```
/services/
├── extraction.ts                    # Core extraction logic
│   ├── queueDocumentExtraction()   # Queue a job
│   └── processExtractionJob()      # Process extraction
│
├── upload.ts                        # File upload logic
├── ocr-provider.ts                  # OCR abstraction
└── policies.ts                      # Policy data logic
```

### Database

```
/lib/
├── redis.ts                         # Redis queue functions
│   ├── enqueueExtractionJob()      # Add to queue
│   ├── getNextJob()                # Retrieve next job
│   └── completeJob()               # Mark complete
│
├── supabase.ts                      # Supabase client
└── schemas.ts                       # Type definitions
```

## Complete Workflow

### 1. Upload Phase

**Endpoint**: `POST /api/upload`

```
Input: File(s) + policyId + customerId
  ↓
Store file in Supabase Storage
  ↓
Create policy_documents record
  ↓
Create extraction_jobs record (status=queued)
  ↓
Queue job in Redis (queue:extraction list)
  ↓
Return: documentId + jobId
```

**Database Records Created**:
- `policy_documents.id` = document ID
- `policy_documents.file_url` = URL to stored file
- `extraction_jobs.id` = job ID
- `extraction_jobs.status` = 'queued'

### 2. Queuing Phase

**Redis Structure**:
```
queue:extraction = [jobId1, jobId2, jobId3, ...]  (list/queue)
job:jobId1 = { id, type, payload, createdAt }     (hash/JSON)
```

### 3. Worker Processing Phase

**Endpoint**: `GET /api/worker/extract` (called by cron/scheduler)

```
For each job (up to MAX_PARALLEL_EXTRACTIONS parallel):
  ↓
Get job from Redis queue (rpop)
  ↓
Update status to 'processing'
  ↓
Extract text from PDF (OCR)
  ↓
Parse into structured data (AI parsing)
  ↓
Update extraction_jobs:
  - status = 'completed'
  - extracted_data = { customer_name, policy_number, etc }
  - completed_at = now
  ↓
Update policy_documents:
  - extraction_status = 'extracted'
  ↓
Update policies:
  - policy_number, policy_type, dates, premium
  ↓
Delete job from Redis
```

### 4. Error Handling

```
If extraction fails:
  ↓
Update extraction_jobs:
  - status = 'failed'
  - error_message = error details
  ↓
Mark job with retry flag
  ↓
Re-queue if retries < MAX_RETRIES
  ↓
Otherwise: log failure and delete from queue
```

## Job States

### State Machine

```
                    ┌─────────────┐
                    │   QUEUED    │ (Initial)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ PROCESSING  │ (Worker running)
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         ┌────▼──────┐           ┌──────▼────┐
         │ COMPLETED │           │  FAILED   │
         │ (Success) │           │ (Retried) │
         └───────────┘           └───────────┘
```

### Database Schema

**extraction_jobs table**:
```sql
CREATE TABLE extraction_jobs (
  id UUID PRIMARY KEY,                    -- Job ID
  document_id UUID,                       -- Reference to uploaded file
  status TEXT,                            -- queued/processing/completed/failed
  job_id TEXT,                            -- Unique identifier
  error_message TEXT,                     -- Error details if failed
  extracted_data JSONB,                   -- ⚠️ MUST ADD: OCR results
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

## Configuration

### Environment Variables

```env
# Redis Queue
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Extraction Worker
EXTRACTION_WORKER_SECRET=your-secret-key
MAX_PARALLEL_EXTRACTIONS=5

# OCR Providers (choose one)
OCR_PROVIDER=google-document-ai    # Default
GOOGLE_APPLICATION_CREDENTIALS=/path/to/creds.json
GOOGLE_CLOUD_PROJECT_ID=xxx
GOOGLE_CLOUD_PROCESSOR_ID=xxx

# Fallback providers
GEMINI_API_KEY=xxx
OPENROUTER_API_KEY=sk-or-xxx
```

## Calling the System

### Manual Extraction (Development)

```bash
# Check status
curl -H "authorization: Bearer test-secret" \
  http://localhost:3000/api/debug/extraction-jobs

# Run worker manually
curl -H "authorization: Bearer test-secret" \
  http://localhost:3000/api/worker/extract

# Get job details
curl -H "authorization: Bearer test-secret" \
  http://localhost:3000/api/debug/job-details
```

### Automated Extraction (Production)

**Option 1: Supabase Cron Job**

```json
{
  "name": "extraction-worker",
  "function": "extraction-worker",
  "schedule": "*/5 * * * *",  // Every 5 minutes
  "method": "POST"
}
```

**Option 2: External Scheduler (Vercel Cron)**

```
/app/api/cron/extract/route.ts:

export const config = {
  maxDuration: 300,  // 5 minutes
};

export async function GET(request) {
  // Verify cron secret
  // Call extraction worker
  // Return results
}
```

**Option 3: Custom Scheduler**

```bash
# Run every 5 minutes
*/5 * * * * curl -H "authorization: Bearer $SECRET" \
  https://yourapp.com/api/worker/extract
```

## Monitoring & Debugging

### Debug Endpoints

All return JSON responses and require `authorization: Bearer test-secret` header.

#### 1. Job Status Overview
```
GET /api/debug/extraction-jobs

Response:
{
  "summary": {
    "totalJobs": 100,
    "queuedCount": 5,
    "processingCount": 2,
    "completedCount": 92,
    "failedCount": 1
  },
  "jobs": {
    "queued": [...],
    "processing": [...],
    "completed": [...],
    "failed": [...]
  }
}
```

#### 2. Full Job Records
```
GET /api/debug/job-details

Response:
{
  "jobs": [
    {
      "id": "job-id",
      "status": "completed",
      "extracted_data": { ... },
      "error_message": null,
      "completed_at": "2026-04-14T15:18:39Z"
    }
  ]
}
```

#### 3. Redis Queue Status
```
GET /api/debug/redis-inspect

Response:
{
  "queueLength": 5,
  "jobIds": ["job1", "job2", ...],
  "jobDetails": [
    {
      "jobId": "job1",
      "hasData": true,
      "data": { ... }
    }
  ]
}
```

#### 4. Manual Job Recovery
```
POST /api/debug/fix-extraction
Body: {"action": "reset-processing"}  // or retry-failed, clear-errors

Response: { "success": true, "affected": 3 }
```

## Performance Considerations

### Parallelization

- **MAX_PARALLEL_EXTRACTIONS**: Controls concurrent jobs (default: 5)
- Each job takes ~10-30 seconds depending on file size and AI provider
- Recommended: 5-10 parallel jobs based on your API rate limits

### Rate Limiting

- **Google Document AI**: 100 requests/min
- **OpenRouter**: Based on your plan (free has limits)
- **Gemini**: 100 requests/min (free tier)

### Memory Usage

- Each extraction job holds ~1-5MB in memory
- With 5 parallel: ~5-25MB per worker cycle
- Redis queue stores metadata only (~1KB per job)

## Troubleshooting

### Issue: Only 1 of 4 PDFs Extracted

**Cause**: `extracted_data` column missing from database

**Solution**:
```sql
ALTER TABLE extraction_jobs ADD COLUMN IF NOT EXISTS extracted_data JSONB;
```

### Issue: Jobs Stuck in Processing

**Solution**:
```bash
curl -X POST -H "authorization: Bearer test-secret" \
  http://localhost:3000/api/debug/fix-extraction \
  -d '{"action":"reset-processing"}'
```

### Issue: Worker Returns 500 Error

**Cause**: Unhandled exception in extraction logic

**Solution**: Check server logs for `[v0]` prefix errors and fix the specific issue

### Issue: Redis Queue Growing

**Cause**: Worker not running or failing

**Solution**: 
1. Check worker secret is correct
2. Check worker endpoint is accessible
3. Check OCR provider credentials
4. Check database permissions

## Best Practices

1. **Always verify database migration before deployment**
2. **Monitor Redis queue length** - should be near zero after worker runs
3. **Set up alerts** for failed extraction jobs
4. **Regular backups** of extraction_jobs table
5. **Log all extraction attempts** for audit trails
6. **Test with sample PDFs** before production
7. **Configure appropriate MAX_PARALLEL_EXTRACTIONS** based on your API limits

## Future Enhancements

1. Webhook notifications when extraction completes
2. Manual extraction retry UI
3. Extraction confidence scoring
4. Multi-page PDF support
5. Batch processing optimization
6. Extraction result caching
7. Advanced error recovery
8. Custom field mapping

---

**Last Updated**: 2026-04-14
**Version**: 1.0.0
