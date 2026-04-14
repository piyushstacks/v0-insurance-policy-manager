/**
 * Debug - Check extraction job details from database
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.EXTRACTION_WORKER_SECRET;

    if (secretToken && authHeader !== `Bearer ${secretToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the full job records with all fields
    const { data: jobs, error } = await supabaseAdmin!
      .from('extraction_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      jobCount: jobs?.length || 0,
      jobs: jobs || [],
    });
  } catch (error) {
    console.error('[v0/debug] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
