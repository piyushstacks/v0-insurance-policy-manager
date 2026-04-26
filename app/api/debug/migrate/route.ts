/**
 * Database Migration Runner
 * Provides SQL migration script to add missing columns
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.EXTRACTION_WORKER_SECRET;

    if (!secretToken || authHeader !== `Bearer ${secretToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[v0/migrate] Migration requested');

    return NextResponse.json({
      success: true,
      message: 'Please run the migration SQL in your Supabase SQL Editor',
      migrationSQL: `
-- 1. Fix Reminders Check Constraint (Allow flexible days like 15 days)
ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_reminder_type_check;

-- 2. Add Reminder Preferences to Profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS reminder_preferences JSONB;

-- 3. Enhance Extraction Jobs tracking
ALTER TABLE extraction_jobs ADD COLUMN IF NOT EXISTS extracted_data JSONB;
ALTER TABLE extraction_jobs ADD COLUMN IF NOT EXISTS confidence_score FLOAT;
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status_completed ON extraction_jobs(status, completed_at DESC);

-- 4. Add Team Contact Details
ALTER TABLE teams ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS phone TEXT;

-- 5. PERFORMANCE INDEXES (FOR HUGE DATA HANDLING)
-- Indexed lookups for policies by user and status
CREATE INDEX IF NOT EXISTS idx_policies_user_status ON policies(user_id, status);
-- Fast expiry/start date range queries
CREATE INDEX IF NOT EXISTS idx_policies_dates ON policies(user_id, expiry_date, start_date);
-- Faster customer lookups
CREATE INDEX IF NOT EXISTS idx_customers_user_name ON customers(user_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_contact ON customers(user_id, email, mobile);
-- Scheduled reminders optimization
CREATE INDEX IF NOT EXISTS idx_reminders_user_scheduled ON reminders(user_id, status, scheduled_date);

-- 6. HIGH-PERFORMANCE DASHBOARD AGGREGATE
CREATE OR REPLACE FUNCTION get_active_premium_sum(uid UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(premium_amount), 0)
    FROM policies
    WHERE user_id = uid AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
      `.trim(),
      steps: [
        '1. Copy the SQL script above',
        '2. Go to Supabase Dashboard → SQL Editor',
        '3. Run this script to fix "constraint violation" errors and enable new reminder features',
        '4. Refresh your application',
      ],
    });
  } catch (error) {
    console.error('[v0/migrate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
