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

export async function POST(request: NextRequest) {
  try {
    const { data: { user } } = await getAuthSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { items } = body; // Array of { id, order_index }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    const teamUserIds = await getTeamUserIds(user.id);

    // Update each item
    // Note: Supabase JS doesn't have a bulk update for multiple different IDs with different payloads cleanly without upsert.
    // Upsert requires all columns. We will do a loop of promises which is fine for small lists (like daily follow-ups < 50 items).
    const promises = items.map((item: any) => 
      supabaseAdmin!
        .from('business_followups')
        .update({ order_index: item.order_index })
        .eq('id', item.id)
        .in('user_id', teamUserIds)
    );

    await Promise.all(promises);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
