import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  try {
     const { data: policies, error } = await supabaseAdmin!
       .from('policies')
       .select('*, customer:customers(name), insurer:insurers(name)');

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

     return NextResponse.json({
       data: {
         totalPremium,
         totalPolicies,
         activePolicies,
         customersCount: customerIds.size,
         companiesCount: companyIds.size,
         companyChartData: companyChartData.length > 0 ? companyChartData : [{ name: 'No Data Yet', premium: 0 }],
         customerChartData: customerChartData.length > 0 ? customerChartData : [{ name: 'No Data Yet', premium: 0 }],
         topCustomers: topCustomers,
       }
     });
  } catch (error: any) {
     return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
