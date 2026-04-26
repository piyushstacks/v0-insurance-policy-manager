/**
 * Dashboard Service
 * Provides KPI metrics and analytics for the dashboard
 */

import { supabaseAdmin } from '@/lib/supabase';

export interface DashboardMetrics {
  totalPolicies: number;
  activePolicies: number;
  expiringSoon: number;
  pendingReminders: number;
  totalCoverageValue: number;
  totalPremiumValue: number;
  recentActivities: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    created_at: string;
  }>;
}

/**
 * Get dashboard metrics for a user
 */
export async function getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
  try {
    // Get total policies count
    const { count: totalCount } = await supabaseAdmin!
      .from('policies')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get active policies count
    const { count: activeCount } = await supabaseAdmin!
      .from('policies')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active');

    // Get expiring soon (30 days)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    const { count: expiringCount } = await supabaseAdmin!
      .from('policies')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')
      .gte('coverage_end', new Date().toISOString().split('T')[0])
      .lte('coverage_end', futureDate.toISOString().split('T')[0]);

    // Get pending reminders
    const { count: reminderCount } = await supabaseAdmin!
      .from('reminders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    // Get total premium value safely
    // Note: In a production environment with crores of data, this should be handled via a database RPC function:
    // "SELECT SUM(premium_amount) FROM policies WHERE user_id = $1 AND status = 'active'"
    const { data: premiumStats, error: premiumError } = await supabaseAdmin!
      .rpc('get_active_premium_sum', { uid: userId });
    
    let totalPremium = 0;
    if (!premiumError && premiumStats !== null) {
      totalPremium = premiumStats;
    } else {
      // Fallback for smaller datasets if RPC isn't deployed yet
      const { data: fallbackData } = await supabaseAdmin!
        .from('policies')
        .select('premium_amount')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1000); // Guardrails for massive datasets
      totalPremium = (fallbackData || []).reduce((sum, p) => sum + (p.premium_amount || 0), 0);
    }

    // Get recent audit logs
    const { data: auditData } = await supabaseAdmin!
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      totalPolicies: totalCount || 0,
      activePolicies: activeCount || 0,
      expiringSoon: expiringCount || 0,
      pendingReminders: reminderCount || 0,
      totalCoverageValue: (totalCount || 0) * 1000, // Placeholder
      totalPremiumValue: totalPremium,
      recentActivities: auditData || [],
    };
  } catch (error) {
    console.error('[v0] Failed to fetch dashboard metrics:', error);
    throw error;
  }
}

/**
 * Get status breakdown for policies
 */
export async function getPoliciesStatusBreakdown(userId: string) {
  try {
    const statuses = ['active', 'expired', 'cancelled', 'pending_renewal'];
    const breakdown: Record<string, number> = {};

    for (const status of statuses) {
      const { count } = await supabaseAdmin!
        .from('policies')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', status);

      breakdown[status] = count || 0;
    }

    return breakdown;
  } catch (error) {
    console.error('[v0] Failed to fetch status breakdown:', error);
    throw error;
  }
}

/**
 * Get extraction job statistics
 */
export async function getExtractionStats(userId: string) {
  try {
    const statuses = ['pending', 'processing', 'completed', 'failed'];
    const stats: Record<string, number> = {};

    for (const status of statuses) {
      const { count } = await supabaseAdmin!
        .from('extraction_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', status);

      stats[status] = count || 0;
    }

    return stats;
  } catch (error) {
    console.error('[v0] Failed to fetch extraction stats:', error);
    throw error;
  }
}
