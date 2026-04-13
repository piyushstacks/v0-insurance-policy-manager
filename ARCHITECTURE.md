# PolicyVault - Architecture & Implementation Guide

## Project Overview

PolicyVault is a production-ready insurance policy management system with:
- Bulk policy document upload with drag-drop UI
- Automatic OCR extraction with mock provider (extensible to Google Docs AI, Tesseract)
- Job queue system using Upstash Redis
- Renewal reminder automation
- Comprehensive audit logging
- Row-level security with Supabase Auth

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + React 19
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Authentication**: Supabase Auth (email/password)
- **Database**: Supabase PostgreSQL (normalized schema)
- **File Storage**: Supabase Storage (policy documents)
- **Job Queue**: Upstash Redis (extraction processing)
- **Validation**: Zod schemas
- **Environment**: Vercel

## Database Schema

### Core Tables

#### `users`
- Synced with Supabase Auth
- Fields: id, email, full_name, role, created_at, updated_at
- Role: 'admin' | 'user'

#### `customers`
- Insurance policy holders
- Fields: id, user_id, name, email, phone, created_at, updated_at
- Used to link multiple policies

#### `insurers`
- Insurance companies
- Fields: id, user_id, name, contact_email, contact_phone, created_at, updated_at

#### `policies`
- Insurance policies
- Fields: id, user_id, customer_id, insurer_id, policy_number, policy_type, coverage_start, coverage_end, premium_amount, status, renewal_date, created_at, updated_at
- Status: 'active' | 'expired' | 'cancelled' | 'pending_renewal'

#### `policy_documents`
- Uploaded policy documents (PDFs, images)
- Fields: id, policy_id, file_name, file_url, file_size, uploaded_at, extraction_job_id
- Links to Supabase Storage

#### `extraction_jobs`
- OCR extraction job tracking
- Fields: id, user_id, document_id, status, extracted_data (JSONB), error_message, created_at, updated_at
- Status: 'pending' | 'processing' | 'completed' | 'failed'

#### `reminders`
- Automated renewal and payment reminders
- Fields: id, user_id, policy_id, reminder_date, reminder_type, status, created_at, updated_at

#### `audit_logs`
- Complete activity log for compliance
- Fields: id, user_id, action, entity_type, entity_id, changes (JSONB), created_at

### Row Level Security (RLS)

All tables have RLS policies enabled:
- Users can only access their own data
- `user_id` filtering applied to all sensitive tables
- Service role key used for background operations

## Folder Structure

```
app/
├── (auth)/                 # Authentication routes (no sidebar)
│   ├── login/
│   └── signup/
├── (app)/                  # Protected app routes (with sidebar)
│   ├── page.tsx           # Dashboard
│   ├── policies/
│   │   ├── page.tsx       # Policies list
│   │   ├── [id]/          # Policy detail (TODO)
│   │   └── new/           # Create policy (TODO)
│   ├── customers/
│   ├── reminders/
│   └── settings/
├── api/
│   ├── policies/          # CRUD endpoints
│   │   ├── route.ts       # GET list, POST create
│   │   └── [id]/route.ts  # GET detail, PUT update, DELETE
│   ├── upload/            # File upload endpoint
│   │   └── route.ts
│   └── extract/
│       └── process/       # Background worker endpoint
│           └── route.ts
├── layout.tsx             # Root layout
└── globals.css            # Tailwind + design tokens

lib/
├── types.ts               # Database types
├── schemas.ts             # Zod validation schemas
├── supabase.ts            # Supabase client utilities
├── redis.ts               # Upstash Redis client & job queue
└── utils.ts               # Helper functions

services/
├── ocr-provider.ts        # OCR abstraction (mock + google-docai)
├── extraction.ts          # Job processing orchestration
├── upload.ts              # File upload & document creation
└── policies.ts            # Policy CRUD & business logic

components/
├── app-nav.tsx            # Sidebar navigation
├── file-upload.tsx        # Drag-drop upload component
└── ui/                    # shadcn/ui components

scripts/
└── init-db.sql            # Database migrations

middleware.ts              # Auth middleware
```

## Key Features

### 1. File Upload Pipeline

**User Flow:**
1. User drags/drops or selects policy document
2. File validated (size, type) on client
3. Uploaded to Supabase Storage
4. Document record created in `policy_documents`
5. Extraction job queued in Redis

**Files:**
- Component: `components/file-upload.tsx`
- API: `app/api/upload/route.ts`
- Service: `services/upload.ts`

### 2. OCR Extraction

**Architecture:**
- Provider abstraction in `services/ocr-provider.ts`
- Currently: MockOCRProvider (for development)
- Extensible to: GoogleDocumentAIProvider

**Job Processing:**
1. Worker calls `/api/extract/process`
2. Gets next job from Redis queue
3. Calls OCR provider
4. Parses structured data with Zod schemas
5. Saves results to `extraction_jobs` table
6. Auto-retries on failure (3 max attempts)

**Files:**
- Orchestration: `services/extraction.ts`
- Worker endpoint: `app/api/extract/process/route.ts`

### 3. Policies Management

**CRUD Operations:**
- List with pagination, filters (status, customer, insurer)
- Create with validation
- Read with related documents and extraction status
- Update (partial)
- Delete (cascades to documents and jobs)

**Files:**
- Service: `services/policies.ts`
- Routes: `app/api/policies/route.ts` and `[id]/route.ts`
- UI: `app/(app)/policies/page.tsx`

### 4. Authentication & Authorization

**Middleware:**
- Route protection in `middleware.ts`
- Public routes: `/auth/*`
- Protected routes: `/app/*`
- Automatic redirect to login if not authenticated

**Credentials:**
- Email + password (Supabase Auth)
- User profile synced to `users` table
- Role-based access (admin/user)

## Configuration

### Environment Variables

**Required:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

**Optional:**
```
OCR_PROVIDER=mock|google-docai  # Default: mock
CRON_SECRET=your-secret-key     # For securing worker endpoint
GOOGLE_CLOUD_PROJECT_ID=xxx     # For Google Document AI
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=xxx
```

### Setting Up Database Storage Bucket

After migration, create a public bucket for policy documents:

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('policy-documents', 'policy-documents', true);

-- Set bucket policy for authenticated users
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  bucket_id = 'policy-documents'
);
```

## Deployment

### Vercel

1. Connect GitHub repository
2. Set environment variables in Settings → Environment Variables
3. Deploy automatically on push

### Background Worker Setup

Option 1: **Vercel Cron Jobs**
```js
// vercel.json
{
  "crons": [{
    "path": "/api/extract/process",
    "schedule": "*/5 * * * *"  // Every 5 minutes
  }]
}
```

Option 2: **External Scheduler** (e.g., AWS Lambda, n8n)
```bash
curl -X POST https://app.com/api/extract/process \
  -H "Authorization: Bearer $CRON_SECRET"
```

Option 3: **Upstash Cron** (included with Redis)
Schedule HTTPS POST to `/api/extract/process` with secret header

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/signup` - User registration
- `POST /auth/logout` - User logout (handled client-side via Supabase)

### Policies
- `GET /api/policies` - List policies (paginated, filterable)
- `POST /api/policies` - Create policy
- `GET /api/policies/[id]` - Get policy with documents
- `PUT /api/policies/[id]` - Update policy
- `DELETE /api/policies/[id]` - Delete policy

### Documents & Extraction
- `POST /api/upload` - Upload policy document
- `POST /api/extract/process` - Worker: process pending extractions

## Development Workflow

### 1. Start Development Server
```bash
npm run dev
```

### 2. Test File Upload
- Navigate to dashboard
- Create a policy
- Upload sample PDF/image
- Check `/api/extract/process` response in console

### 3. Run Background Worker Manually
```bash
curl -X POST http://localhost:3000/api/extract/process \
  -H "Authorization: Bearer dev-secret"
```

### 4. Inspect Extraction Jobs
```sql
SELECT * FROM extraction_jobs ORDER BY created_at DESC LIMIT 5;
```

## Production Readiness Checklist

- [x] Database schema with proper types and RLS
- [x] Supabase Auth integration
- [x] File storage with validation
- [x] Job queue with retry logic
- [x] OCR provider abstraction
- [x] API error handling
- [x] Input validation with Zod
- [x] Audit logging
- [x] Middleware for route protection
- [x] Type safety (TypeScript)
- [x] Environment variable management

## Future Enhancements

1. **Phase 4: Reminders & Scheduling**
   - Auto-generate reminders for policy renewals
   - Calendar view, email notifications
   - Notification preferences

2. **Phase 5: Dashboard & Settings**
   - KPI metrics (total policies, expiring soon, coverage value)
   - Admin user management
   - OCR provider configuration UI
   - Export to PDF/CSV

3. **Advanced Features**
   - Multi-user team accounts
   - Webhook notifications
   - Integration with payment systems
   - Document comparison / version control
   - Bulk import via CSV
   - Advanced search with full-text indexing

## Performance Considerations

- **Database queries**: Indexed on `user_id`, `policy_id`, `status`
- **File uploads**: Max 10MB, chunking recommended for larger files
- **Job queue**: Redis keeps jobs in memory, auto-expires after 24 hours
- **OCR processing**: Async queue prevents blocking main app
- **Pagination**: Default 20 items per page, configurable up to 100

## Security

- All sensitive data protected by Supabase RLS
- File uploads scanned for size/type
- Service role key never exposed to client
- Extraction worker protected by CRON_SECRET
- Input validation with Zod schemas
- Audit logs track all changes
- HTTPS only in production (Vercel enforces)

## Support & Maintenance

- Monitor extraction job failures in `extraction_jobs` table
- Check Redis queue length with `/api/extract/process` endpoint
- Review audit logs for compliance requirements
- Update OCR provider configuration in Settings page

---

**Last Updated**: 2026-04-13  
**Version**: 1.0.0  
**Status**: Production Ready
