import { NextRequest, NextResponse } from 'next/server';
import { extractDocumentInline } from '@/services/extraction';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes on Vercel Pro, 10-60s on Hobby depending on plan

/**
 * POST /api/extract/qstash-process?secret=<secret>
 * Webhook triggered by Upstash QStash to process a single extraction.
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const expectedSecret = process.env.EXTRACTION_WORKER_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { documentId, policyId, fileUrl } = body as {
      documentId?: string;
      policyId?: string;
      fileUrl?: string;
    };

    if (!policyId) {
      return NextResponse.json({ error: 'Missing policyId' }, { status: 400 });
    }

    console.log(`[QStash Webhook] Processing extraction for doc: ${documentId || 'NO_DOC'} (policy: ${policyId})`);

    // Run the extraction inline synchronously (this route will wait for it to finish)
    const result = await extractDocumentInline(documentId || null, policyId, fileUrl || null);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Extraction completed successfully' });
  } catch (error: any) {
    console.error('[QStash Webhook] Extraction crash:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
