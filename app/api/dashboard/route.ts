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
       .select('*, customer:customers(name), insurer:insurers(name), life_policies(sum_assured)')
       .in('user_id', teamUserIds);

     if (error) throw error;
     const allPolicies = (policies || []).filter(p => {
       const pn = p.policy_number || '';
       return !pn.startsWith('PENDING_OCR') && 
              !pn.startsWith('BULK_OCR') && 
              !pn.startsWith('IMG-') && 
              !pn.startsWith('doc_');
     });
     
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
     const totalPolicies = filteredPolicies.length;
     const activePolicies = filteredPolicies.filter(p => p.status === 'active').length;
     
     const customerIds = new Set(filteredPolicies.map(p => p.customer_id).filter(Boolean));
     const companyIds = new Set(filteredPolicies.map(p => p.insurer_id).filter(Boolean));

     function getCategory(insurerName: string, insuranceType: string, policyType: string): 'Life' | 'Health' | 'General' {
         const iName = (insurerName || '').toLowerCase();
         const iType = (insuranceType || '').toLowerCase();
         const pType = (policyType || '').toLowerCase();
         const typeStr = `${iType} ${pType}`;

         // 1. Type keywords
         const healthKeywords = ['health', 'mediclaim', 'critical illness', 'hospicash', 'top-up', 'super top-up', 'opd', 'personal accident'];
         if (healthKeywords.some(k => typeStr.includes(k))) return 'Health';

         const lifeKeywords = ['life', 'term', 'ulip', 'endowment', 'whole life', 'money back', 'pension', 'annuity', 'child plan', 'retirement'];
         if (lifeKeywords.some(k => typeStr.includes(k))) return 'Life';

         const generalKeywords = ['motor', 'car', 'bike', '2 wheeler', '4 wheeler', 'commercial vehicle', 'sme', 'fire', 'marine', 'travel', 'property', 'shopkeeper', 'liability', 'cyber', 'engineering', 'burglary'];
         if (generalKeywords.some(k => typeStr.includes(k))) return 'General';

         // 2. Insurer keywords
         const lifeInsurers = ['lic', 'tata aia', 'hdfc life', 'icici prudential', 'sbi life', 'max life', 'bajaj allianz life', 'kotak mahindra life', 'aditya birla sun', 'pnb metlife', 'canara hsbc', 'bharti axa life', 'future generali india life', 'edelweiss tokio', 'pramerica', 'puravankara', 'star union', 'indiafirst', 'aegon', 'bandhan life', 'shriram life', 'reliance nippon', 'exide life', 'ageas federal'];
         if (lifeInsurers.some(k => iName.includes(k))) return 'Life';

         const healthInsurers = ['star health', 'niva bupa', 'max bupa', 'care health', 'religare', 'aditya birla health', 'manipalcigna', 'reliance health'];
         if (healthInsurers.some(k => iName.includes(k))) return 'Health';

         // 3. Default to General (including disambiguation fallback)
         return 'General';
     }

     // Sector wise AUM (Sum Assured based)
     const sectorMap: Record<string, number> = { Life: 0, Health: 0, General: 0 };
     allPolicies.filter(p => ['active', 'renewed'].includes(p.status)).forEach(p => {
         const category = getCategory(p.insurer?.name, p.insurance_type, p.policy_type);
         let sa = p.sum_insured || 0;
         if (category === 'Life') {
             sa = p.life_policies?.[0]?.sum_assured || p.sum_insured || 0;
         }
         sectorMap[category] = (sectorMap[category] || 0) + sa;
     });
     
     const totalAUM = Object.values(sectorMap).reduce((a,b) => a+b, 0);
     // Filter out 0 AUM sectors for the donut chart
     const sectorAUM = Object.entries(sectorMap).map(([name, aum]) => ({ name, aum })).filter(s => s.aum > 0).sort((a,b) => b.aum - a.aum);

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

     // --- TIME SERIES GENERATION FOR LINE CHARTS ---
     const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
     const trendPeriods: string[] = [];
     for (let i = 5; i >= 0; i--) {
         const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
         trendPeriods.push(`${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`);
     }

     const sectorAUMTrend: any[] = [];
     const companyAUMTrend: any[] = [];
     const top5Companies = companyChartData.slice(0, 5).map(c => c.name);

     for (let i = 0; i < trendPeriods.length; i++) {
         const periodEnd = new Date(now.getFullYear(), now.getMonth() - 5 + i + 1, 0, 23, 59, 59); // Last day of that month
         
         const activeUpToMonth = allPolicies.filter(p => {
              const d = new Date(p.start_date || p.created_at);
              return d <= periodEnd && ['active', 'renewed'].includes(p.status);
         });

         const sTrend: any = { period: trendPeriods[i], Life: 0, Health: 0, General: 0 };
         const cTrend: any = { period: trendPeriods[i] };
         top5Companies.forEach(c => cTrend[c] = 0);

         activeUpToMonth.forEach(p => {
              const category = getCategory(p.insurer?.name, p.insurance_type, p.policy_type);
              sTrend[category] += (p.premium_amount || 0);

              const compName = p.insurer?.name || 'Unknown Company';
              if (top5Companies.includes(compName)) {
                  cTrend[compName] += (p.premium_amount || 0);
              }
         });
         
         sectorAUMTrend.push(sTrend);
         companyAUMTrend.push(cTrend);
     }

     return NextResponse.json({
       data: {
         totalPremium,
         totalAUM,
         sectorAUM,
         sectorAUMTrend,
         companyAUMTrend,
         top5Companies,
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
