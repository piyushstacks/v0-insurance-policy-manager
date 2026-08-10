import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getTeamUserIds, getUserTeam } from '@/services/team';

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

export async function GET(request: NextRequest) {
  try {
    const { data: { user } } = await getAuthSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const dateStr = searchParams.get('date'); 
    const localToday = searchParams.get('localToday'); 
    const search = searchParams.get('search');

    const membership = await getUserTeam(user.id);
    let allowedUserIds = [user.id];

    if (membership && (membership.role === 'ADMIN' || membership.role === 'SUB_ADMIN')) {
      allowedUserIds = await getTeamUserIds(user.id);
    }

    if (search) {
      const cleanSearch = search.replace(/,/g, '');
      const q1 = supabaseAdmin!
        .from('business_followups')
        .select(`
          *,
          customer:customers(id, name, mobile, email)
        `)
        .overlaps('assignees', allowedUserIds)
        .or(`prospect_name.ilike.%${cleanSearch}%,notes.ilike.%${cleanSearch}%,category.ilike.%${cleanSearch}%`)
        .order('scheduled_date', { ascending: false })
        .limit(50);

      const q2 = supabaseAdmin!
        .from('business_followups')
        .select(`
          *,
          customer:customers!inner(id, name, mobile, email)
        `)
        .overlaps('assignees', allowedUserIds)
        .or(`name.ilike.%${cleanSearch}%,mobile.ilike.%${cleanSearch}%`, { foreignTable: 'customers' })
        .order('scheduled_date', { ascending: false })
        .limit(50);

      const [res1, res2] = await Promise.all([q1, q2]);
      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;

      const map = new Map();
      [...(res1.data || []), ...(res2.data || [])].forEach(item => {
        map.set(item.id, item);
      });
      const finalData = Array.from(map.values()).sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());
      
      return NextResponse.json({ data: finalData });
    }

    let query = supabaseAdmin!
      .from('business_followups')
      .select(`
        *,
        customer:customers(id, name, mobile, email)
      `)
      .overlaps('assignees', allowedUserIds)
      .order('order_index', { ascending: true })
      .order('scheduled_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (dateStr) {
      if (localToday && dateStr === localToday) {
        // If viewing 'Today', show today's items + any past overdue (pending) items
        query = query.or(`scheduled_date.eq.${dateStr},and(status.eq.pending,scheduled_date.lt.${dateStr})`);
      } else {
        // If viewing past/future date, strictly show that date
        query = query.eq('scheduled_date', dateStr);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data: { user } } = await getAuthSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { customer_id, prospect_name, prospect_mobile, category, notes, scheduled_date, assignees } = body;

    if (!customer_id && !prospect_name) {
      return NextResponse.json({ error: 'Customer or Prospect Name is required' }, { status: 400 });
    }
    if (!scheduled_date) {
      return NextResponse.json({ error: 'Scheduled date is required' }, { status: 400 });
    }

    let finalAssignees = [user.id];
    if (assignees && Array.isArray(assignees) && assignees.length > 0) {
       const teamUserIds = await getTeamUserIds(user.id);
       finalAssignees = assignees.filter(id => teamUserIds.includes(id));
       if (finalAssignees.length === 0) finalAssignees = [user.id];
    }

    const { data, error } = await supabaseAdmin!
      .from('business_followups')
      .insert({
        user_id: user.id, // Creator
        assignees: finalAssignees,
        customer_id: customer_id || null,
        prospect_name: prospect_name || null,
        prospect_mobile: prospect_mobile || null,
        category: category || '',
        notes: notes || '',
        scheduled_date,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
