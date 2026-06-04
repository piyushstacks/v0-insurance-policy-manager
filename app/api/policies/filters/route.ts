import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getTeamUserIds } from '@/services/team';

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
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const teamUserIds = await getTeamUserIds(user.id);

    // Fetch unique products (policy_type)
    const { data: policiesData } = await supabaseAdmin!
      .from('policies')
      .select('policy_type')
      .in('user_id', teamUserIds)
      .not('policy_number', 'ilike', 'PENDING_OCR%')
      .not('policy_number', 'ilike', 'BULK_OCR%');
      
    const uniqueProducts = Array.from(new Set(
      (policiesData || []).map(p => p.policy_type).filter(Boolean)
    ));

    // Fetch insurers used by this user's policies
    const { data: insurersData } = await supabaseAdmin!
      .from('policies')
      .select('insurer_id, insurer:insurers(name)')
      .in('user_id', teamUserIds)
      .not('policy_number', 'ilike', 'PENDING_OCR%');

    const uniqueCompanies = Array.from(new Set(
      (insurersData || []).map(p => p.insurer?.name).filter(Boolean)
    ));

    return NextResponse.json({ products: uniqueProducts, companies: uniqueCompanies }, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch filters:', error);
    return NextResponse.json({ error: 'Failed to fetch filters' }, { status: 500 });
  }
}
