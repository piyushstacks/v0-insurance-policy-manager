# PolicyVault - Project Index & Documentation Guide

## 📚 Documentation Map

Start here based on your role and needs:

### For Getting Started (First Time)
1. **[README.md](./README.md)** - Overview and quick start
2. **[SETUP.md](./SETUP.md)** - Detailed setup and deployment instructions
3. **Run**: `npm install && npm run dev`

### For Understanding Architecture
1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed system design
   - Database schema
   - API endpoints
   - Service architecture
   - OCR provider abstraction
   - Security and performance

### For Deployment
1. **[SETUP.md](./SETUP.md)** - Complete deployment guide
   - Vercel setup
   - Environment configuration
   - Cron job scheduling
   - Troubleshooting

### For Development
1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design and patterns
2. **Code files** - Read inline comments in services and API routes

---

## 📁 Project Structure Overview

### Frontend Routes (`app/`)
```
(auth)/
  ├── login/       - Email/password login form
  └── signup/      - User registration form

(app)/
  ├── page.tsx     - Dashboard with KPI metrics
  ├── policies/    - Policy management pages
  ├── customers/   - Customer management (placeholder)
  ├── reminders/   - Reminder list and management
  └── settings/    - Configuration and info
```

### Backend API Routes (`app/api/`)
```
policies/
  ├── route.ts     - GET (list), POST (create)
  └── [id]/route.ts - GET (detail), PUT (update), DELETE

upload/
  └── route.ts     - POST file upload

extract/
  └── process/route.ts - Worker: process extraction jobs

reminders/
  ├── route.ts     - GET reminders
  └── generate/route.ts - Worker: generate daily reminders
```

### Services (`services/`)
```
ocr-provider.ts     - OCR abstraction layer
extraction.ts       - Job queue orchestration
upload.ts          - File upload handling
policies.ts        - Policy CRUD operations
reminders.ts       - Reminder management
dashboard.ts       - Dashboard metrics
```

### Utilities (`lib/`)
```
types.ts           - TypeScript database types
schemas.ts         - Zod validation schemas
supabase.ts        - Supabase client setup
redis.ts           - Upstash Redis client & queue
```

### Database Scripts (`scripts/`)
```
init-db.sql        - Main schema migration
setup-storage.sql  - Storage bucket setup
```

---

## 🎯 Key Workflows

### 1. User Registration & Login
```
User visits /auth/signup
→ Fills form
→ Supabase Auth creates user
→ User profile created in database
→ Redirected to /auth/login
→ Login successful
→ Redirect to /app (dashboard)
```

### 2. Policy Upload & Extraction
```
User uploads document
→ File validated (client-side)
→ POST to /api/upload
→ Upload to Supabase Storage
→ Create document record
→ Queue extraction job in Redis
→ Return to user
→ [BACKGROUND] Worker processes job
→ Extract text with OCR provider
→ Parse into structured data
→ Update extraction_jobs table
→ Display results in UI
```

### 3. Reminder Generation
```
[DAILY CRON] POST /api/reminders/generate
→ Query policies expiring in 30 days
→ Create reminder records
→ [USER SEES] Reminders in /app/reminders
→ [USER CLICK] Dismiss or view policy
```

### 4. Policy Management
```
Dashboard → Policies
→ List all policies (paginated)
→ Filter by status/customer/insurer
→ View policy details + documents
→ Edit policy
→ Delete policy (cascades)
```

---

## 🔧 Configuration Checklist

### Before Development
- [ ] Create `.env.local` with all required variables
- [ ] Run `npm install`
- [ ] Run `npm run migrate` (or execute `init-db.sql` in Supabase)
- [ ] Run `npm run dev`

### Before Deployment
- [ ] Set all environment variables in Vercel
- [ ] Execute `setup-storage.sql` in Supabase
- [ ] Configure `vercel.json` with cron jobs
- [ ] Test workers manually before deploying
- [ ] Set up monitoring/logging

### Production Requirements
- [ ] CRON_SECRET environment variable set
- [ ] Database backups enabled
- [ ] Error tracking configured (optional but recommended)
- [ ] Monitoring for job queue health
- [ ] Audit log retention policy

---

## 📊 Database Schema Quick Reference

### Core Tables
- **users** - Auth users, synced with Supabase Auth
- **customers** - Policy holders
- **insurers** - Insurance companies
- **policies** - Insurance policies
- **policy_documents** - Uploaded documents
- **extraction_jobs** - OCR job tracking
- **reminders** - Automated reminders
- **audit_logs** - Activity log

All tables have RLS policies enabled. Users can only see their own data.

---

## 🚀 Common Tasks

### Add a New API Endpoint
1. Create file in `app/api/[resource]/route.ts`
2. Implement GET/POST/PUT/DELETE handlers
3. Use Supabase client for database
4. Add authentication check
5. Validate input with Zod schemas
6. Test with curl or Postman

### Create a New Service Function
1. Create file in `services/[name].ts`
2. Implement business logic
3. Use supabaseAdmin for database operations
4. Add error handling and logging
5. Export typed functions
6. Call from API routes

### Add a New Page
1. Create folder in `app/(app)/[page]/`
2. Create `page.tsx` (client or server component)
3. Import components
4. Add navigation link in `app-nav.tsx`
5. Test routing

### Schedule a Background Job
1. Create `/api/[task]/process` endpoint
2. Implement job processing logic
3. Add CRON_SECRET validation
4. In `vercel.json`: Add cron expression
5. Or use Upstash console to schedule

---

## 🔐 Security Considerations

### Authentication
- Supabase Auth (email/password)
- Session-based with automatic refresh
- Protected API routes with user verification

### Authorization
- Row-level security on all tables
- Users can only access their own data
- Service role key for background workers

### Data Protection
- Input validation with Zod
- File upload validation (size, type)
- SQL injection prevention (Supabase SDK handles)
- Audit logs for compliance

### API Security
- CRON_SECRET for worker endpoints
- No secrets in client-side code
- Environment variables for all sensitive config

---

## 📈 Performance Tips

### Database
- Queries are indexed on `user_id`, `status`, `policy_id`
- Pagination default: 20 items per page
- Use filters to reduce result sets

### File Storage
- Max file size: 10MB
- Supported types: PDF, JPG, PNG
- Files stored in Supabase Storage (S3 backend)

### Job Queue
- Redis stores jobs in memory
- Jobs auto-expire after 24 hours
- Retry up to 3 times on failure
- Process 1 job at a time per worker

### Frontend
- Next.js server-side rendering where possible
- Client-side caching with SWR
- Incremental static regeneration (ISR)

---

## 🐛 Debugging Tips

### View Extraction Jobs
```sql
SELECT id, status, error_message, created_at 
FROM extraction_jobs 
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC LIMIT 10;
```

### Check Redis Queue
```bash
curl https://[YOUR_REDIS_URL]/llen/queue:extraction \
  -H "Authorization: Bearer [YOUR_TOKEN]"
```

### Monitor Reminders
```sql
SELECT id, reminder_date, reminder_type, status 
FROM reminders 
WHERE user_id = 'your-user-id'
ORDER BY reminder_date DESC;
```

### View Audit Logs
```sql
SELECT action, entity_type, entity_id, changes, created_at 
FROM audit_logs 
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC LIMIT 20;
```

---

## 📞 Support Resources

### Official Documentation
- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

### This Project
- [README.md](./README.md) - Overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical details
- [SETUP.md](./SETUP.md) - Setup and deployment

### Community
- [Supabase Discord](https://discord.supabase.io)
- [Next.js Discord](https://discord.gg/nextjs)
- [Tailwind CSS Discord](https://discord.gg/tailwindcss)

---

## 🎓 Learning Path

### Beginner
1. Read [README.md](./README.md)
2. Follow [SETUP.md](./SETUP.md) to get local instance running
3. Create a test account
4. Upload a policy document
5. Check extraction results

### Intermediate
1. Read [ARCHITECTURE.md](./ARCHITECTURE.md)
2. Study database schema in `scripts/init-db.sql`
3. Review API endpoints in `app/api/`
4. Understand service layer in `services/`
5. Examine React components in `components/`

### Advanced
1. Understand OCR provider abstraction
2. Study job queue implementation
3. Review security and RLS policies
4. Analyze performance optimizations
5. Plan custom enhancements

---

## 🎯 Next Steps

**To Get Started:**
1. Run `npm install && npm run dev`
2. Go to http://localhost:3000
3. Create test account
4. Test file upload and extraction
5. Review code in `services/` and `app/api/`

**To Deploy:**
1. Push to GitHub
2. Connect to Vercel
3. Set environment variables
4. Configure cron jobs
5. Enable Supabase backups

**To Extend:**
1. Review [ARCHITECTURE.md](./ARCHITECTURE.md)
2. Study existing patterns
3. Create new services in `services/`
4. Add new API endpoints in `app/api/`
5. Build UI components

---

**Version**: 1.0.0  
**Status**: Production Ready  
**Last Updated**: 2026-04-13

