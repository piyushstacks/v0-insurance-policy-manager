import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { extractDocumentInline, triggerExtractionQueue } from '@/services/extraction';

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

    const { getTeamUserIds } = await import('@/services/team');
    const teamUserIds = await getTeamUserIds(user.id);

    const body = await request.json().catch(() => ({}));
    const { policyIds, documentId, policyId } = body as {
      policyIds?: string[];
      documentId?: string;
      policyId?: string;
    };

    // Pre-fetch team policies to avoid tricky Supabase PostgREST inner join filters
    const { data: teamPoliciesData } = await supabaseAdmin!
      .from('policies')
      .select('id')
      .in('user_id', teamUserIds);
    const validPolicyIds = (teamPoliciesData || []).map(p => p.id);

    // --- Single document re-extraction ---
    if (documentId && policyId) {
      if (!validPolicyIds.includes(policyId)) {
         return NextResponse.json({ error: 'Unauthorized or policy not found' }, { status: 403 });
      }

      const { data: doc, error: docErr } = await supabaseAdmin!
        .from('policy_documents')
        .select('file_path')
        .eq('id', documentId)
        .eq('policy_id', policyId)
        .single();

      if (docErr || !doc) {
        console.error('[API/Retry] Document not found or error:', docErr);
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }

      const baseUrl = process.env.B2_PUBLIC_URL || process.env.NEXT_PUBLIC_B2_PUBLIC_URL;
      const publicUrl = `${baseUrl?.replace(/\/$/, '')}/${doc.file_path}`;

      // Reset extraction status
      await supabaseAdmin!
        .from('policy_documents')
        .update({ extraction_status: 'pending' })
        .eq('id', documentId);

      // Fire inline extraction (non-blocking)
      triggerExtractionQueue(documentId, policyId, publicUrl).catch(console.error);

      return NextResponse.json({ success: true, message: 'Extraction restarted for document' });
    }

    // --- Bulk re-extraction for selected / all policies ---
    if (validPolicyIds.length === 0) {
      return NextResponse.json({ success: true, message: 'No policies found for this user/team', count: 0 });
    }

    let query = supabaseAdmin!
      .from('policy_documents')
      .select('id, file_path, policy_id');

    if (policyIds && policyIds.length > 0) {
      const allowedIds = policyIds.filter(id => validPolicyIds.includes(id));
      if (allowedIds.length === 0) {
        return NextResponse.json({ success: true, message: 'No valid documents found to re-extract', count: 0 });
      }
      query = query.in('policy_id', allowedIds);
    } else {
      query = query.in('policy_id', validPolicyIds);
    }

    const { data: docs, error: docsErr } = await query;
    if (docsErr) {
       console.error('[API/Retry] Bulk docs error:', docsErr);
       throw docsErr;
    }
    
    if (!docs || docs.length === 0) {
      return NextResponse.json({ success: true, message: 'No documents found to re-extract', count: 0 });
    }

    // Reset all to pending
    await supabaseAdmin!
      .from('policy_documents')
      .update({ extraction_status: 'pending' })
      .in('id', docs.map(d => d.id));

    // Fire all inline extractions (non-blocking) with staggered delay
    let docIndex = 0;
    for (const doc of docs) {
      const baseUrl = process.env.B2_PUBLIC_URL || process.env.NEXT_PUBLIC_B2_PUBLIC_URL;
      const publicUrl = `${baseUrl?.replace(/\/$/, '')}/${doc.file_path}`;
      triggerExtractionQueue(doc.id, doc.policy_id, publicUrl, docIndex * 13).catch(console.error);
      docIndex++;
    }

    return NextResponse.json({
      success: true,
      message: `Re-extraction started for ${docs.length} document(s)`,
      count: docs.length,
    });
  } catch (error: any) {
    console.error('[v0] Re-extraction error:', error);
    return NextResponse.json(
      { error: error?.message || String(error) },
      { status: 500 }
    );
  }
}
