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
-- Add extracted_data column to store OCR results
ALTER TABLE extraction_jobs ADD COLUMN IF NOT EXISTS extracted_data JSONB;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status_completed 
  ON extraction_jobs(status, completed_at DESC);
      `.trim(),
      steps: [
        '1. Go to Supabase Dashboard → Your Project',
        '2. Click SQL Editor in the left sidebar',
        '3. Click "New Query" button',
        '4. Copy and paste the migrationSQL above',
        '5. Click "Run" button',
        '6. The extracted_data column will now be available',
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
