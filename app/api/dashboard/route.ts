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

     const { data: policies, error } = await supabaseAdmin!
       .from('policies')
       .select('*, customer:customers(name), insurer:insurers(name)')
       .in('user_id', teamUserIds);

     if (error) throw error;
     const allPolicies = policies || [];
     
     // Core Metrics
     const totalPremium = allPolicies.reduce((acc, p) => acc + (p.premium_amount || 0), 0);
     const totalPolicies = allPolicies.length;
     const activePolicies = allPolicies.filter(p => p.status === 'active').length;
     
     const customerIds = new Set(allPolicies.map(p => p.customer_id).filter(Boolean));
     const companyIds = new Set(allPolicies.map(p => p.insurer_id).filter(Boolean));

     // Chart Data (Group by Company and Customer)
     const companyMap: Record<string, number> = {};
     const customerMap: Record<string, {name: string, premium: number, policies: number}> = {};

     allPolicies.forEach(p => {
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

     const recentPolicies = [...allPolicies]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

     return NextResponse.json({
       data: {
         totalPremium,
         totalPolicies,
         activePolicies,
         customersCount: customerIds.size,
         companiesCount: companyIds.size,
         companyChartData: companyChartData.length > 0 ? companyChartData : [{ name: 'No Data Yet', premium: 0 }],
         customerChartData: customerChartData.length > 0 ? customerChartData : [{ name: 'No Data Yet', premium: 0 }],
         topCustomers,
         recentPolicies
       }
     });
  } catch (error: any) {
     return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
