import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import redis from '@/lib/redis';

export const maxDuration = 60; // 60 seconds max

export async function POST(request: Request) {
  try {
    // Basic auth check for worker routes (same as extract/qstash-process)
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    const qstashToken = process.env.QSTASH_TOKEN;
    const workerSecret = process.env.EXTRACTION_WORKER_SECRET;
    
    let isAuthorized = false;
    
    // Check QStash token
    if (qstashToken && authHeader === `Bearer ${qstashToken}`) {
      isAuthorized = true;
    } 
    // Check manual worker secret
    else if (workerSecret && authHeader === `Bearer ${workerSecret}`) {
      isAuthorized = true;
    }
    
    if (!isAuthorized && process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get all unique user_ids from policies who have active policies
    const { data: users, error: usersErr } = await supabaseAdmin!
      .from('policies')
      .select('user_id')
      .in('status', ['active', 'renewed']);
      
    if (usersErr) throw usersErr;
    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: 'No users found' });
    }

    // Deduplicate user_ids
    const uniqueUserIds = [...new Set(users.map(u => u.user_id))];

    for (const userId of uniqueUserIds) {
      // 2. Cross-Sell Candidates
      // Customers with only 1 insurance_type
      const { data: userPolicies } = await supabaseAdmin!
        .from('policies')
        .select(`
          insurance_type,
          customer_id,
          customers ( id, name, email, mobile )
        `)
        .eq('user_id', userId)
        .in('status', ['active', 'renewed']);

      const customerTypesMap = new Map<string, Set<string>>();
      const customerInfoMap = new Map<string, any>();

      if (userPolicies) {
        for (const p of userPolicies) {
          if (!p.customer_id) continue;
          if (!customerTypesMap.has(p.customer_id)) {
            customerTypesMap.set(p.customer_id, new Set<string>());
            customerInfoMap.set(p.customer_id, p.customers);
          }
          if (p.insurance_type) {
             customerTypesMap.get(p.customer_id)!.add(p.insurance_type);
          }
        }
      }

      const crossSellCandidates = Array.from(customerTypesMap.entries())
        .filter(([_, types]) => types.size === 1) // Only 1 type of policy
        .map(([id, types]) => ({
          customer: customerInfoMap.get(id),
          existing_type: Array.from(types)[0],
          missing_types: ['life', 'health', 'motor', 'commercial'].filter(t => t !== Array.from(types)[0])
        })).slice(0, 10); // Limit to top 10

      // 3. At-Risk Renewals (Next 30 days, no recent reminder sent)
      const next30Days = new Date();
      next30Days.setDate(next30Days.getDate() + 30);
      
      const { data: expiringPolicies } = await supabaseAdmin!
        .from('policies')
        .select(`
          id, policy_number, expiry_date, insurance_type, premium_amount, customer_id,
          customers ( id, name, mobile, email )
        `)
        .eq('user_id', userId)
        .in('status', ['active', 'renewed'])
        .gte('expiry_date', new Date().toISOString().split('T')[0])
        .lte('expiry_date', next30Days.toISOString().split('T')[0]);

      let atRiskCandidates: any[] = [];

      if (expiringPolicies && expiringPolicies.length > 0) {
        // Fetch recent reminders (last 14 days)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const policyIds = expiringPolicies.map(p => p.id);
        const { data: recentReminders } = await supabaseAdmin!
          .from('reminders')
          .select('policy_id, status')
          .in('policy_id', policyIds)
          .eq('status', 'sent')
          .gte('updated_at', fourteenDaysAgo.toISOString());

        const recentlyContactedPolicyIds = new Set(recentReminders?.map(r => r.policy_id) || []);

        atRiskCandidates = expiringPolicies
          .filter(p => !recentlyContactedPolicyIds.has(p.id))
          .map(p => ({
             policy_id: p.id,
             policy_number: p.policy_number,
             expiry_date: p.expiry_date,
             insurance_type: p.insurance_type,
             premium_amount: p.premium_amount,
             customer: p.customers,
             days_to_expiry: Math.ceil((new Date(p.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
          }))
          .sort((a, b) => a.days_to_expiry - b.days_to_expiry);
      }

      // Store in Redis
      const cacheKey = `dashboard:gap_detection:${userId}`;
      await redis.set(cacheKey, JSON.stringify({
        crossSell: crossSellCandidates,
        atRisk: atRiskCandidates,
        updated_at: new Date().toISOString()
      }), { ex: 7 * 24 * 60 * 60 }); // Cache for 7 days
    }

    return NextResponse.json({ success: true, processedUsers: uniqueUserIds.length });
  } catch (error: any) {
    console.error('Gap detection worker error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
