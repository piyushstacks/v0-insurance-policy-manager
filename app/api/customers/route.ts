import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

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
           policy_type
         )
      `)
      .neq('name', 'Bulk Upload Customer')
      .order('name', { ascending: true });

    if (error) throw error;
    
    // Process top-level metrics for each customer safely
    const formatted = customers.map(c => {
       const userPolicies = Array.isArray(c.policies) ? c.policies : (c.policies ? [c.policies] : []);
       const totalPremium = userPolicies.reduce((acc: number, p: any) => acc + (p.premium_amount || 0), 0);
       return {
          id: c.id,
          name: c.name,
          email: c.email,
          mobile: c.mobile,
          policiesCount: userPolicies.length,
          totalPremium
       };
    });

    return NextResponse.json({ data: formatted }, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
