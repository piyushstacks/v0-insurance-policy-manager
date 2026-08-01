import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

    let query = supabaseAdmin!
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
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
    const { title, description, category, priority, scheduled_date } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!scheduled_date) {
      return NextResponse.json({ error: 'Scheduled date is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin!
      .from('todos')
      .insert({
        user_id: user.id,
        title,
        description: description || null,
        category: category || 'Personal',
        priority: priority || 'Medium',
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
