import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') || '20'));
    const search = searchParams.get('search') || '';

    const { getTeamUserIds } = await import('@/services/team');
    const teamUserIds = await getTeamUserIds(user.id);

    let query = supabaseAdmin!
      .from('customers')
      .select(`
         id,
         name,
         email,
         mobile,
         policies (
           id,
           premium_amount,
           policy_type,
           expiry_date
         )
      `, { count: 'exact' })
      .in('user_id', teamUserIds)
      .neq('name', 'Bulk Upload Customer');

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,mobile.ilike.%${search}%`);
    }

    const { data: customers, error, count } = await query
      .order('name', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;
    
    // Process top-level metrics for each customer safely
    const formatted = customers.map(c => {
       const userPolicies = Array.isArray(c.policies) ? c.policies : (c.policies ? [c.policies] : []);
       const totalPremium = userPolicies.reduce((acc: number, p: any) => acc + (p.premium_amount || 0), 0);
       
       const upcomingRenewals = userPolicies
         .map((p: any) => p.expiry_date)
         .filter((date: string | null) => date && new Date(date) >= new Date())
         .sort((a: any, b: any) => new Date(a).getTime() - new Date(b).getTime());
         
       return {
          id: c.id,
          name: c.name,
          email: c.email,
          mobile: c.mobile,
          policiesCount: userPolicies.length,
          totalPremium,
          nextRenewal: upcomingRenewals.length > 0 ? upcomingRenewals[0] : null
       };
    });

    return NextResponse.json({ data: formatted, total: count || 0, page, pageSize }, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
