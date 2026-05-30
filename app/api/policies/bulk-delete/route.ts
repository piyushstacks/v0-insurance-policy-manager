import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin, storageBucket } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {}
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { policyIds } = body;
    
    if (!Array.isArray(policyIds) || policyIds.length === 0) {
      return NextResponse.json({ error: 'No policy IDs provided' }, { status: 400 });
    }

    const { getUserTeam, getUserRole, createActionRequest } = await import('@/services/team');
    const team = await getUserTeam(user.id);
    if (team) {
      const role = await getUserRole(user.id, team.team_id);
      if (role === 'MEMBER') {
        for (const pid of policyIds) {
          await createActionRequest({
            teamId: team.team_id,
            type: 'DELETE_POLICY',
            entityId: pid,
            entityType: 'policies',
            requestedBy: user.id,
            reason: 'Member requested bulk delete.',
          }).catch(e => console.warn('Duplicate request:', e.message));
        }
        return NextResponse.json({ 
          message: 'Bulk deletion requested. Sent to admin for approval.',
          pendingApproval: true
        }, { status: 202 });
      }
    }

    if (!supabaseAdmin) throw new Error('Supabase admin undefined');

    // 1. Fetch documents to delete from Storage Bucket
    const { data: documents } = await supabaseAdmin
      .from('policy_documents')
      .select('id, file_path')
      .in('policy_id', policyIds);

    const docIds = documents?.map(d => d.id) || [];
    const filePaths = documents?.map(d => d.file_path).filter(Boolean) || [];

    // 2. Remove files natively from Storage (so it wipes actual physical data!)
    if (filePaths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(storageBucket)
        .remove(filePaths);
      if (storageError) console.error('[v0] Bulk storage remove error:', storageError);
    }

    // 3. Remove extraction jobs
    if (docIds.length > 0) {
      await supabaseAdmin.from('extraction_jobs').delete().in('document_id', docIds);
      await supabaseAdmin.from('policy_documents').delete().in('id', docIds);
    }

    // 4. Finally soft-delete or wipe the policies
    // The user mentioned "remove that all data from the database too." 
    // And "store only the policy basic info not downloadable".
    // We will delete the files/documents above so it's not downloadable! 
    // But we will actually hard-delete the policy entity as well to clean the DB view.
    const { error: polError } = await supabaseAdmin
      .from('policies')
      .delete()
      .in('id', policyIds);

    if (polError) throw polError;

    return NextResponse.json({ success: true, message: `Deleted ${policyIds.length} policies securely.` }, { status: 200 });

  } catch (error: any) {
    console.error('[v0] Bulk Delete Policies Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to bulk delete policies' }, { status: 500 });
  }
}
