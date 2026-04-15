# Insurance Policy Manager — AI Context Document
> This file is loaded by MCP (Model Context Protocol) so AI assistants have accurate, hallucination-free context about this project.

## Project Identity
- **Name**: Insurance Policy Manager (v0)
- **Stack**: Next.js 16/React 19, TypeScript, Tailwind v4, Supabase (Postgres + Storage + Auth), Upstash Redis, Radix UI
- **Purpose**: Helps Apex Solutions (insurance brokerage) manage policies, customers, insurers, and extract data from uploaded PDF documents using OCR + AI

---

## Architecture Overview

```
Browser Client
  └── Next.js App Router (/app/app/...)
        ├── /policies        → Policy list, upload, detail pages
        ├── /customers       → Customer management
        ├── /settings        → App settings
        └── /api/...         → API routes (upload, worker, debug, auth)

Backend Services (/services/)
  ├── upload.ts             → File upload to Supabase Storage + queuing
  ├── extraction.ts         → OCR orchestration (inline + queue-based)
  └── ocr-provider.ts       → Multi-provider OCR (pdf-parse + Gemini + OpenRouter)

Infrastructure
  ├── Supabase              → DB, Auth, Storage, Realtime
  ├── Upstash Redis         → Job queue (extraction pipeline)
  └── Google Document AI    → (optional) heavy OCR for scanned PDFs
```

---

## Database Schema (Supabase/Postgres)

### Tables

| Table | Key Columns | Notes |
|---|---|---|
| `users` | id (FK auth.users), email, full_name, role | Admin / Staff roles |
| `customers` | id, name, mobile, email, address | Policyholder info |
| `insurers` | id, name, contact | Insurance companies |
| `policies` | id, customer_id, insurer_id, policy_number, policy_type, start_date, expiry_date, premium_amount, status | Core record |
| `policy_documents` | id, policy_id, file_name, file_path, file_type, raw_ocr_text, extraction_status | Uploaded PDF/image |
| `extraction_jobs` | id, document_id, status, job_id, **extracted_data JSONB**, error_message, completed_at | OCR job tracking |
| `reminders` | id, policy_id, reminder_type, scheduled_date, status | Renewal reminders |
| `audit_logs` | id, user_id, action, table_name, record_id, changes | Full audit trail |

### Critical Note — extraction_jobs
The `extracted_data JSONB` column **MUST exist** on `extraction_jobs`. This was the root cause of the original bulk-upload extraction bug (data was silently discarded). The migration SQL is in `/scripts/migration-add-extracted-data.sql`.

---

## Extraction Pipeline

### Modes
1. **Inline** (`extractDocumentInline`) — used for single file uploads; runs OCR synchronously during the request
2. **Queue-based** (`queueDocumentExtraction` → Redis → `/api/worker/extract`) — used for bulk uploads; async background processing

### Flow
```
uploadPolicyDocument(userId, policyId, file, autoExtract)
  ├─ autoExtract=true  → extractDocumentInline(documentId, policyId, fileUrl)
  └─ autoExtract=false → queueDocumentExtraction(userId, documentId, policyId, fileUrl)
                              └─ Redis queue → /api/worker/extract (cron)
                                    └─ processExtractionJob() → saves to DB
```

### OCR Provider Priority
1. **Google Document AI** (if `OCR_PROVIDER=google-document-ai` and credentials set)
2. **pdf-parse** (fallback local; no GPU needed; fails on scanned/image PDFs)
3. **AI Intelligence** (OpenRouter free models → Gemini) extracts structured fields from raw text

### Consensus Fallback
If `customer_name` is missing/unknown after primary extraction, `consensusExtract()` is automatically triggered — runs multiple AI models and picks best result.

---

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/upload` | POST | Supabase session | Single file upload + inline extraction |
| `/api/upload/bulk` | POST | Supabase session | Bulk upload → Redis queue |
| `/api/worker/extract` | GET | Bearer token | Process queued extraction jobs |
| `/api/debug/extraction-jobs` | GET | Bearer token | View all job statuses |
| `/api/debug/job-details` | GET | Bearer token | Full job details incl. extracted_data |
| `/api/debug/redis-inspect` | GET | Bearer token | Inspect Redis queue |
| `/api/debug/fix-extraction` | POST | Bearer token | Reset/retry stuck/failed jobs |
| `/api/debug/migrate` | POST | Bearer token | Returns migration SQL |

**Auth header for worker/debug routes**: `Authorization: Bearer test-secret` (set via `EXTRACTION_WORKER_SECRET`)

---

## Environment Variables (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://vvueurxfbdrfbdanxbnl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://major-buck-97646.upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Worker
EXTRACTION_WORKER_SECRET=test-secret
MAX_PARALLEL_EXTRACTIONS=5

# AI
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...

# Google Document AI (optional)
OCR_PROVIDER=google-document-ai
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
GOOGLE_CLOUD_PROJECT_ID=gen-lang-client-0974182957
GOOGLE_CLOUD_LOCATION=us
GOOGLE_CLOUD_PROCESSOR_ID=   # Must be set to activate Document AI
```

---

## Key Files

| File | Purpose |
|---|---|
| `services/extraction.ts` | Core extraction logic — `processExtractionJob`, `extractDocumentInline` |
| `services/ocr-provider.ts` | OCR engine abstraction — pdf-parse, Gemini, OpenRouter, Document AI |
| `services/upload.ts` | File upload to Supabase Storage, calls extraction |
| `lib/redis.ts` | Upstash Redis helpers — enqueue, getNextJob, completeJob, failJob |
| `lib/supabase.ts` | Supabase client (anon + admin service role) |
| `lib/schemas.ts` | Zod schemas — `ExtractionResult` type |
| `app/api/upload/bulk/route.ts` | Bulk upload API — creates placeholder policy/customer/insurer then queues |
| `app/api/worker/extract/route.ts` | Worker that drains Redis queue in parallel |
| `scripts/init-db.sql` | Full DB schema (run on fresh Supabase project) |
| `scripts/migration-add-extracted-data.sql` | Migration for existing DBs — adds `extracted_data` column |

---

## Known Issues & Fixes Applied

| Issue | Status | Fix |
|---|---|---|
| `extracted_data` column missing from `extraction_jobs` | ✅ Fixed | Added to `init-db.sql` + migration SQL in `/scripts/migration-add-extracted-data.sql` — **Run this in Supabase SQL Editor if upgrading** |
| `.env.local` had corrupted/duplicated lines | ✅ Fixed | Cleaned to single canonical section per service |
| Bulk upload: only 1 of N PDFs extracted | ✅ Fixed | Was caused by missing `extracted_data` column causing silent write failures |
| Redis job data occasionally missing (orphaned queue entry) | ✅ Fixed | Added detailed logging in `lib/redis.ts` `getNextJob()` |

---

## Supabase Migration — MUST RUN ON EXISTING DB

If the database was initialized before the fix, run this in **Supabase SQL Editor**:

```sql
ALTER TABLE extraction_jobs ADD COLUMN IF NOT EXISTS extracted_data JSONB;

CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status_completed
  ON extraction_jobs(status, completed_at DESC);
```

---

## Bulk Upload Placeholder Strategy

During bulk upload, placeholder rows are inserted so the pipeline doesn't fail:
- **Customer**: `Bulk Upload Customer` (email: `bulk@upload.local`)
- **Insurer**: `Bulk Upload Insurer`
- **Policy number**: `BULK_OCR_{timestamp}_{random}`

After extraction completes, these placeholders are **overwritten** with real OCR-extracted values (customer name, insurer, policy type, dates, premium).

---

## Testing Quick Reference

```bash
# Run dev server
npm run dev

# Trigger worker manually
curl -H "authorization: Bearer test-secret" http://localhost:3000/api/worker/extract | jq .

# Check all job statuses
curl -H "authorization: Bearer test-secret" http://localhost:3000/api/debug/extraction-jobs | jq .summary

# Retry all failed jobs
curl -X POST http://localhost:3000/api/debug/fix-extraction \
  -H "authorization: Bearer test-secret" \
  -H "Content-Type: application/json" \
  -d '{"action":"retry-failed"}'

# Inspect Redis queue
curl -H "authorization: Bearer test-secret" http://localhost:3000/api/debug/redis-inspect | jq .
```

---

## Coding Conventions

- All server logs use `[v0]` prefix (e.g., `console.log('[v0] ...')`)
- Redis worker logs use `[v0/redis]`
- Inline extraction logs use `[v0/inline]`
- OCR provider logs use `[v0/OCR]` and `[v0/AI]`
- All API routes set `export const runtime = 'nodejs'` (no Edge Runtime — pdf-parse needs Node)
- Admin Supabase client (`supabaseAdmin`) is used for all server-side DB writes
- RLS is enabled on all tables; service role key bypasses it for worker operations

---

---

## AI Co-Pilot behavioral Guidelines (Autonomous Builder Mode)

This project is managed in **Autonomous Builder Mode**. All AI interactions must follow the principles defined in:
1. **[.cursorrules](file:///Users/piyushbhagchandani/Apex%20Solutions/policy%20manager/v0-insurance-policy-manager/.cursorrules)** — Core behavioral instructions for execution-focused assistance.
2. **[.gemini/instructions.md](file:///Users/piyushbhagchandani/Apex%20Solutions/policy%20manager/v0-insurance-policy-manager/.gemini/instructions.md)** — Supplementary/Global Gemini-specific instructions.

### Core Principles Summary
- **Execution-Focused**: Do not suggest; execute. No "you could" or "you should".
- **Real-World Output**: Always provide working, production-ready code.
- **Direct & Practical**: Minimal explanation, maximal action.
- **GitHub Automation**: Meaningful commit messages and pushes on logical units of work.

---

*Last updated: 2026-04-15*
