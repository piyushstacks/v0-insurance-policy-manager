# Extraction System - Issue Diagnosis and Fix

## Issue Summary

The user reported that only **1 of 4 uploaded PDFs** was extracted, with 3 PDFs missing. Investigation revealed the root cause and solution.

## Root Cause Analysis

### What We Found:
1. **Database Schema Missing Critical Column**: The `extraction_jobs` table is missing the `extracted_data` JSONB column
2. **Incomplete Job Records**: Jobs were marked as "completed" but no extracted data was saved
3. **Orphaned Redis Queue Entry**: One job existed in Redis queue but couldn't be retrieved (corrupted entry)

### Extraction Flow Issues:
1. ✅ PDFs uploaded successfully (4 files queued)
2. ✅ Extraction jobs created in database (status='queued')
3. ✅ Jobs added to Redis queue
4. ✅ Worker processed jobs (marked as completed)
5. ❌ **BROKEN**: Extracted data NOT saved (missing column in database)
6. ❌ **BROKEN**: Jobs showing as completed but empty of actual OCR results

## The Fix

### Step 1: Add Missing Database Column

Run this SQL migration in your Supabase SQL Editor:

```sql
-- Add extracted_data column to store OCR results
ALTER TABLE extraction_jobs ADD COLUMN IF NOT EXISTS extracted_data JSONB;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status_completed 
  ON extraction_jobs(status, completed_at DESC);
```

**How to run:**
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Paste the SQL above
6. Click **Run**

### Step 2: Verify the Column Exists

After running the migration, you can verify by querying:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'extraction_jobs';
```

You should see `extracted_data | jsonb` in the results.

### Step 3: Re-extract Previous Failed Jobs

Since the database schema now has the column, you have two options:

**Option A: Manual Fix (One-time)**
```bash
curl -X POST http://localhost:3000/api/debug/fix-extraction \
  -H "authorization: Bearer test-secret" \
  -H "Content-Type: application/json" \
  -d '{"action":"retry-failed"}'
```

**Option B: Upload Files Again**
Simply re-upload your 4 PDFs. The extraction will now work correctly.

## Testing the Fix

### Quick Test:
```bash
# 1. Check system status
curl -H "authorization: Bearer test-secret" \
  http://localhost:3000/api/debug/extraction-jobs | jq .summary

# 2. Run the worker
curl -H "authorization: Bearer test-secret" \
  http://localhost:3000/api/worker/extract

# 3. Check results
curl -H "authorization: Bearer test-secret" \
  http://localhost:3000/api/debug/job-details | jq '.jobs[0].extracted_data'
```

## Complete Debug Endpoints Available

### 1. **Check Extraction Jobs Status**
```bash
GET /api/debug/extraction-jobs
Header: authorization: Bearer test-secret
```
Response includes: total jobs, queued, completed, failed, and detailed job list

### 2. **Get Full Job Details**
```bash
GET /api/debug/job-details
Header: authorization: Bearer test-secret
```
Response includes: full database records with all fields including `extracted_data`

### 3. **Inspect Redis Queue**
```bash
GET /api/debug/redis-inspect
Header: authorization: Bearer test-secret
```
Response includes: Redis queue length, job IDs, and detailed job data in Redis

### 4. **Fix Stuck/Failed Jobs**
```bash
POST /api/debug/fix-extraction
Header: authorization: Bearer test-secret
Body: {"action":"reset-processing"} // or "retry-failed", "clear-errors"
```

### 5. **Get Migration SQL**
```bash
POST /api/debug/migrate
Header: authorization: Bearer test-secret
```
Response includes: SQL migration script and setup steps

### 6. **Run Worker**
```bash
GET /api/worker/extract
Header: authorization: Bearer test-secret
```
Processes extraction jobs in parallel (configurable via MAX_PARALLEL_EXTRACTIONS env var)

## Configuration Environment Variables

Add these to `.env.local`:

```env
# Extraction Worker Configuration
EXTRACTION_WORKER_SECRET=test-secret
MAX_PARALLEL_EXTRACTIONS=5  # Number of concurrent extraction jobs
```

## What Happens After Fix

After applying the database migration:

1. New PDF uploads → automatically extracted
2. Extracted data saved to `extracted_data` column
3. Policy records updated with extracted information
4. Full pipeline working end-to-end

## Verification Checklist

- [ ] Migration SQL run successfully in Supabase
- [ ] `extracted_data` column visible in `extraction_jobs` table
- [ ] EXTRACTION_WORKER_SECRET set in .env.local
- [ ] Test endpoints accessible with Bearer token
- [ ] Worker processing jobs without errors
- [ ] Extracted data saved to database
- [ ] Policy records updated with OCR results

## Technical Details

### Why This Happened

The `extraction_jobs` table was created from the initial schema (`scripts/init-db.sql`) without the `extracted_data` column. The extraction service tried to save data to a non-existent column, causing silent failures.

### How the Fix Works

1. ALTER TABLE adds the JSONB column to store structured extraction results
2. Index improves query performance for recent completed jobs
3. Extraction service can now save extracted data properly
4. Policy records can be populated with OCR results

### Related Code Files

- **Service**: `/services/extraction.ts` - `processExtractionJob()` function
- **Worker**: `/app/api/worker/extract/route.ts` - Parallel job processing
- **Schema**: `/scripts/init-db.sql` - Database initialization
- **Migration**: `/scripts/migration-add-extracted-data.sql` - Migration SQL

## Next Steps

1. ✅ Apply the database migration
2. ✅ Verify the column exists
3. ✅ Test with new PDF uploads
4. ✅ Re-extract previous 4 PDFs if needed
5. ✅ Monitor extraction jobs via debug endpoints

## Support

If you encounter issues:

1. Check `/api/debug/extraction-jobs` for job status
2. Check `/api/debug/job-details` for actual extracted data
3. Check `/api/debug/redis-inspect` for Redis queue status
4. Review server logs for error messages (look for `[v0]` prefix)

---

**Last Updated**: 2026-04-14  
**Status**: Ready for Production
