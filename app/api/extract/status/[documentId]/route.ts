import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * GET /api/extract/status/[documentId]
 * Returns extraction status for a given document.
 * Used by the UI to poll background extraction progress.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    // Check the extraction job status
    const { data: job } = await supabaseAdmin!
      .from('extraction_jobs')
      .select('status, error_message, extracted_data, completed_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!job) {
      // Check the document directly
      const { data: doc } = await supabaseAdmin!
        .from('policy_documents')
        .select('extraction_status')
        .eq('id', documentId)
        .maybeSingle();

      return NextResponse.json({
        status: doc?.extraction_status === 'extracted' ? 'completed' : 'pending',
        error: null,
      });
    }

    return NextResponse.json({
      status: job.status === 'completed' ? 'completed' : job.status === 'failed' ? 'failed' : job.status,
      error: job.error_message || null,
      completedAt: job.completed_at || null,
    });
  } catch (error) {
    console.error('[status] Error checking extraction status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed', status: 'unknown' },
      { status: 500 }
    );
  }
}
