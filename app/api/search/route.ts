import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getTeamUserIds } from '@/services/team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q')?.trim() || '';
    if (q.length < 2) {
      return NextResponse.json({ customers: [], policies: [] });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const teamUserIds = await getTeamUserIds(user.id);
    const pattern = `%${q}%`;

    const [customersRes, policiesRes] = await Promise.all([
      supabaseAdmin!
        .from('customers')
        .select('id, name, mobile, email')
        .in('user_id', teamUserIds)
        .or(`name.ilike.${pattern},mobile.ilike.${pattern},email.ilike.${pattern}`)
        .limit(6),

      supabaseAdmin!
        .from('policies')
        .select('id, policy_number, status, insurer:insurers(name)')
        .in('user_id', teamUserIds)
        .ilike('policy_number', pattern)
        .limit(6),
    ]);

    return NextResponse.json({
      customers: customersRes.data || [],
      policies: policiesRes.data || [],
    });
  } catch (err: any) {
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
