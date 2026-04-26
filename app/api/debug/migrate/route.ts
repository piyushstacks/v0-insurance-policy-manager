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
