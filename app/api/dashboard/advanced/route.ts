import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAdvancedDashboardMetrics } from '@/services/dashboard-cache';

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
          setAll() {}, // Read-only on GET
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const metrics = await getAdvancedDashboardMetrics(user.id);
    return NextResponse.json({ data: metrics }, { status: 200 });
  } catch (error: any) {
    console.error('Failed to fetch advanced dashboard metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch advanced dashboard metrics' }, { status: 500 });
  }
}
