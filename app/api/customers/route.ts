import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { data: customers, error } = await supabaseAdmin!
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
      `)
      .neq('name', 'Bulk Upload Customer')
      .order('name', { ascending: true });

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

    return NextResponse.json({ data: formatted }, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
