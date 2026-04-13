# PolicyVault - Setup & Deployment Guide

## Quick Start

### 1. Clone & Install

```bash
# Clone the repository
git clone <your-repo-url> policyvault
cd policyvault

# Install dependencies
npm install
# or
pnpm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Optional: Cron Secret for background workers
CRON_SECRET=your-secure-random-secret-key

# Optional: OCR Provider (default: mock)
OCR_PROVIDER=mock
```

### 3. Database Setup

The database schema is created automatically via the migration script. Run:

```bash
npm run migrate
```

Or manually in Supabase SQL Editor:
1. Go to your Supabase project → SQL Editor
2. Click "New Query"
3. Copy the contents of `scripts/init-db.sql`
4. Execute the query

### 4. Storage Bucket Setup

After running the migration, create a public storage bucket:

1. Go to Supabase → Storage
2. Click "Create a new bucket"
3. Name it `policy-documents`
4. Make it public
5. Add bucket policy:

```sql
-- In Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public) 
VALUES ('policy-documents', 'policy-documents', true);

-- Set upload policy
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  bucket_id = 'policy-documents'
);

-- Set download policy
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'policy-documents');
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Testing the Application

### Create Test Account

1. Go to http://localhost:3000/auth/signup
2. Create account with:
   - Email: `test@example.com`
   - Password: `TestPassword123`

### Test File Upload Flow

1. Navigate to Dashboard → Policies
2. Click "Add Policy"
3. Fill in policy details:
   - Customer: Select or create
   - Insurer: Select or create
   - Policy Number: `POL-2024-001`
   - Type: `Home Insurance`
   - Dates: Any valid range
   - Premium: `1200`

4. Upload a test document (PDF or image)
5. Check extraction in `/api/extract/process` response

### Test Background Worker

```bash
# Trigger extraction processing
curl -X POST http://localhost:3000/api/extract/process \
  -H "Authorization: Bearer your-cron-secret"

# Trigger reminder generation
curl -X POST http://localhost:3000/api/reminders/generate \
  -H "Authorization: Bearer your-cron-secret"
```

## Vercel Deployment

### 1. Connect GitHub Repository

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Select your GitHub repository
4. Framework: Next.js

### 2. Set Environment Variables

In Vercel project settings, add:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
CRON_SECRET=your-secure-random-secret-key
```

### 3. Configure Cron Jobs

Create `vercel.json` in root:

```json
{
  "crons": [
    {
      "path": "/api/extract/process",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/reminders/generate",
      "schedule": "0 2 * * *"
    }
  ]
}
```

Then deploy:

```bash
git add .
git commit -m "Add cron jobs configuration"
git push origin main
```

### 4. Verify Deployment

1. Visit your Vercel deployment URL
2. Create test account
3. Test upload flow
4. Check Vercel Logs for worker execution

## Alternative: Upstash Cron Scheduler

Instead of Vercel crons, use Upstash to schedule tasks:

1. Go to [upstash.com/console](https://upstash.com/console)
2. Create an HTTP target:
   - Name: `policyvault-extraction`
   - URL: `https://your-app.vercel.app/api/extract/process`
   - Method: POST
   - Headers: `Authorization: Bearer your-cron-secret`

3. Create schedule:
   - Expression: `*/5 * * * *` (every 5 minutes)
   - Click "Create"

Similarly for reminders (different schedule):
   - Expression: `0 2 * * *` (daily at 2 AM UTC)

## Production Checklist

### Security
- [x] All environment variables are secret
- [x] CRON_SECRET is strong and random
- [x] Supabase RLS is enabled
- [x] Service role key never exposed to client
- [x] File uploads validated (size, type)

### Performance
- [ ] Database indexes created (already in migration)
- [ ] Redis queue monitored
- [ ] Extraction job failures logged
- [ ] API response times < 200ms

### Monitoring
- [ ] Error tracking configured (Sentry recommended)
- [ ] Audit logs retained
- [ ] Background worker logs accessible
- [ ] Uptime monitoring enabled

### Data
- [ ] Database backups enabled in Supabase
- [ ] Regular exports of audit logs
- [ ] Data retention policy documented
- [ ] User data deletion workflow

## Troubleshooting

### Issue: "NEXT_PUBLIC_SUPABASE_URL is not set"

**Solution:** Make sure environment variables are in `.env.local` and restart dev server:
```bash
npm run dev
```

### Issue: File upload fails with "401 Unauthorized"

**Solution:** Check that you're logged in and Supabase auth token is valid:
```bash
# In browser console
const { data } = await supabase.auth.getSession();
console.log(data.session);
```

### Issue: Extraction jobs not processing

**Solution:** 
1. Check Redis connection:
   ```bash
   curl https://[YOUR_REDIS_URL]/get/test -H "Authorization: Bearer [YOUR_TOKEN]"
   ```

2. Manually trigger worker:
   ```bash
   curl -X POST http://localhost:3000/api/extract/process \
     -H "Authorization: Bearer your-cron-secret"
   ```

3. Check logs:
   ```sql
   SELECT * FROM extraction_jobs ORDER BY updated_at DESC LIMIT 10;
   ```

### Issue: Reminders not generating

**Solution:**
1. Check database policies are created
2. Manually trigger reminder generation:
   ```bash
   curl -X POST http://localhost:3000/api/reminders/generate \
     -H "Authorization: Bearer your-cron-secret"
   ```

3. Verify in database:
   ```sql
   SELECT * FROM reminders WHERE user_id = 'YOUR_USER_ID' LIMIT 10;
   ```

## Database Backup

### Automatic Backups (Supabase)
1. Go to Project Settings → Backups
2. Enable automatic daily backups
3. Retention: Keep backups for 30 days

### Manual Export
```bash
# Export entire database
pg_dump -h [host] -U [user] -d [database] > backup.sql

# Or use Supabase CLI
supabase db pull > backup.sql
```

## Scaling Considerations

### Handling High Volume

1. **Database**: Supabase scales automatically. Monitor query performance:
   ```sql
   SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC;
   ```

2. **File Storage**: Supabase Storage uses S3 backend, scales automatically

3. **Job Queue**: Upstash Redis can be upgraded to higher tier:
   - Current: Free tier (1000 concurrent connections)
   - Production: Standard tier for higher throughput

4. **OCR Processing**: Consider:
   - Batch processing (process multiple documents in parallel)
   - Queue job retry delays to avoid overload
   - Use production OCR provider (Google Docs AI) for faster processing

### Optimizations

1. **Database**: Add indexes (already done in migration)
2. **API**: Cache policy lists with ISR
3. **File Storage**: Use CDN for document downloads
4. **OCR**: Switch to async job-based system with Vercel's Cron API

## Support

For issues:
1. Check [Supabase Docs](https://supabase.com/docs)
2. Check [Next.js Docs](https://nextjs.org/docs)
3. Review [ARCHITECTURE.md](./ARCHITECTURE.md)
4. Check application logs in Vercel

---

**Last Updated**: 2026-04-13  
**Version**: 1.0.0
