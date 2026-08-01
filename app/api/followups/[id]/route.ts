import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getTeamUserIds } from '@/services/team';

export const runtime = 'nodejs';

async function getAuthSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
  return await supabase.auth.getUser();
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    const { data: { user } } = await getAuthSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { status, notes, scheduled_date, category, customer_id, prospect_name, prospect_mobile, assignees } = body;

    const teamUserIds = await getTeamUserIds(user.id);

    // Verify ownership
    const { data: existing, error: fetchErr } = await supabaseAdmin!
      .from('business_followups')
      .select('id, user_id, assignees')
      .eq('id', id)
      .in('user_id', teamUserIds)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Follow-up not found or unauthorized' }, { status: 404 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date;
    if (category !== undefined) updates.category = category;
    if (customer_id !== undefined) updates.customer_id = customer_id;
    if (prospect_name !== undefined) updates.prospect_name = prospect_name;
    if (prospect_mobile !== undefined) updates.prospect_mobile = prospect_mobile;
    
    if (assignees !== undefined && Array.isArray(assignees)) {
       const validAssignees = assignees.filter(id => teamUserIds.includes(id));
       updates.assignees = validAssignees.length > 0 ? validAssignees : [existing.user_id];
    }

    const { data, error } = await supabaseAdmin!
      .from('business_followups')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    const { data: { user } } = await getAuthSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const teamUserIds = await getTeamUserIds(user.id);

    const { error } = await supabaseAdmin!
      .from('business_followups')
      .delete()
      .eq('id', id)
      .in('user_id', teamUserIds);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
