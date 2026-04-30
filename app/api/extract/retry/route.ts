import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { extractDocumentInline } from '@/services/extraction';

export const runtime = 'nodejs';

/**
 * POST /api/extract/retry
 * Body: { policyIds?: string[] }   — re-extract specific or all policies
 * Body: { documentId?, policyId? } — re-extract a single document
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
            catch { /* ignore */ }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { policyIds, documentId, policyId } = body as {
      policyIds?: string[];
      documentId?: string;
      policyId?: string;
    };

    // --- Single document re-extraction ---
    if (documentId && policyId) {
      // Get the public file URL
      const { data: doc } = await supabaseAdmin!
        .from('policy_documents')
        .select(`
          file_path,
          policies!inner (
            user_id
          )
        `)
        .eq('id', documentId)
        .eq('policies.user_id', user.id)
        .single();

      if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

      const { data: urlData } = supabaseAdmin!.storage
        .from('policy-documents')
        .getPublicUrl(doc.file_path);

      // Reset extraction status
      await supabaseAdmin!
        .from('policy_documents')
        .update({ extraction_status: 'pending' })
        .eq('id', documentId);

      // Fire inline extraction (non-blocking)
      extractDocumentInline(documentId, policyId, urlData.publicUrl).catch(console.error);

      return NextResponse.json({ success: true, message: 'Extraction restarted for document' });
    }

    // --- Bulk re-extraction for selected / all policies ---
    let query = supabaseAdmin!
      .from('policy_documents')
      .select(`
        id, 
        file_path, 
        policy_id,
        policies!inner (
          user_id
        )
      `)
      .eq('policies.user_id', user.id);

    if (policyIds && policyIds.length > 0) {
      query = query.in('policy_id', policyIds);
    }

    const { data: docs, error: docsErr } = await query;
    if (docsErr) throw docsErr;
    if (!docs || docs.length === 0) {
      return NextResponse.json({ success: true, message: 'No documents found to re-extract', count: 0 });
    }

    // Reset all to pending
    await supabaseAdmin!
      .from('policy_documents')
      .update({ extraction_status: 'pending' })
      .in('id', docs.map(d => d.id));

    // Fire all inline extractions (non-blocking)
    for (const doc of docs) {
      const { data: urlData } = supabaseAdmin!.storage
        .from('policy-documents')
        .getPublicUrl(doc.file_path);
      extractDocumentInline(doc.id, doc.policy_id, urlData.publicUrl).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      message: `Re-extraction started for ${docs.length} document(s)`,
      count: docs.length,
    });
  } catch (error) {
    console.error('[v0] Re-extraction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Re-extraction failed' },
      { status: 500 }
    );
  }
}
