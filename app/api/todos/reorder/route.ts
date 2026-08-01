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

export async function POST(request: NextRequest) {
  try {
    const { data: { user } } = await getAuthSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { items } = body; // Array of { id, order_index }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    // Verify all items belong to the user
    const ids = items.map((i: any) => i.id);
    const { data: existing, error: fetchErr } = await supabaseAdmin!
      .from('todos')
      .select('id')
      .in('id', ids)
      .eq('user_id', user.id);

    if (fetchErr || !existing || existing.length !== items.length) {
      return NextResponse.json({ error: 'Some items not found or unauthorized' }, { status: 403 });
    }

    // Since Supabase RPC isn't guaranteed here, we do multiple updates.
    // For small arrays (e.g. daily tasks), this is acceptable.
    const updates = items.map((item: any) => 
      supabaseAdmin!
        .from('todos')
        .update({ order_index: item.order_index, updated_at: new Date().toISOString() })
        .eq('id', item.id)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
