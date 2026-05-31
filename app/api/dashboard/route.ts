import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

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

     const { getTeamUserIds } = await import('@/services/team');
     const teamUserIds = await getTeamUserIds(user.id);

     const searchParams = request.nextUrl.searchParams;
     const filter = searchParams.get('filter') || 'all'; // all, this_year, prev_fin_year

     const { data: policies, error } = await supabaseAdmin!
       .from('policies')
       .select('*, customer:customers(name), insurer:insurers(name)')
       .in('user_id', teamUserIds);

     if (error) throw error;
     const allPolicies = policies || [];
     
     // Determine date ranges for filters
     const now = new Date();
     let startDate: Date | null = null;
     let endDate: Date | null = null;

     if (filter === 'this_year') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
     } else if (filter === 'prev_fin_year') {
        // Indian Financial Year: April 1 to March 31
        const currentMonth = now.getMonth();
        const startYear = currentMonth >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;
        startDate = new Date(startYear, 3, 1);
        endDate = new Date(startYear + 1, 2, 31, 23, 59, 59);
     }

     const filteredPolicies = allPolicies.filter(p => {
        if (!startDate || !endDate) return true;
        const pDate = new Date(p.created_at);
        return pDate >= startDate && pDate <= endDate;
     });

     // Core Metrics
     const totalPremium = filteredPolicies.reduce((acc, p) => acc + (p.premium_amount || 0), 0);
     const totalAUM = allPolicies.filter(p => p.status === 'active').reduce((acc, p) => acc + (p.premium_amount || 0), 0);
     const totalPolicies = filteredPolicies.length;
     const activePolicies = filteredPolicies.filter(p => p.status === 'active').length;
     
     const customerIds = new Set(filteredPolicies.map(p => p.customer_id).filter(Boolean));
     const companyIds = new Set(filteredPolicies.map(p => p.insurer_id).filter(Boolean));

     // Sector wise AUM
     const sectorMap: Record<string, number> = {};
     allPolicies.filter(p => p.status === 'active').forEach(p => {
         const category = p.policy_type ? p.policy_type.split(' | ')[0] : 'General';
         sectorMap[category] = (sectorMap[category] || 0) + (p.premium_amount || 0);
     });
     const sectorAUM = Object.entries(sectorMap).map(([name, aum]) => ({ name, aum })).sort((a,b) => b.aum - a.aum);

     // Chart Data (Group by Company and Customer for filtered policies)
     const companyMap: Record<string, number> = {};
     const customerMap: Record<string, {name: string, premium: number, policies: number}> = {};

     filteredPolicies.forEach(p => {
         // Map Company
         const compName = p.insurer?.name || 'Unknown Company';
         companyMap[compName] = (companyMap[compName] || 0) + (p.premium_amount || 0);

         // Map Customer
         const custName = p.customer?.name || 'Unknown Customer';
         if (!customerMap[custName]) customerMap[custName] = { name: custName, premium: 0, policies: 0 };
         customerMap[custName].premium += (p.premium_amount || 0);
         customerMap[custName].policies += 1;
     });

     const companyChartData = Object.entries(companyMap)
       .map(([name, premium]) => ({ name, premium }))
       .sort((a,b) => b.premium - a.premium)
       .slice(0, 10);

     const customerChartData = Object.values(customerMap)
       .map(c => ({ name: c.name, premium: c.premium }))
       .sort((a,b) => b.premium - a.premium)
       .slice(0, 10);

     const topCustomers = Object.values(customerMap)
        .sort((a,b) => b.premium - a.premium)
        .slice(0, 5);

     const recentPolicies = [...filteredPolicies]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

     return NextResponse.json({
       data: {
         totalPremium,
         totalAUM,
         sectorAUM,
         totalPolicies,
         activePolicies,
         customersCount: customerIds.size,
         companiesCount: companyIds.size,
         companyChartData: companyChartData.length > 0 ? companyChartData : [{ name: 'No Data', premium: 0 }],
         customerChartData: customerChartData.length > 0 ? customerChartData : [{ name: 'No Data', premium: 0 }],
         topCustomers,
         recentPolicies
       }
     });
  } catch (error: any) {
     return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
