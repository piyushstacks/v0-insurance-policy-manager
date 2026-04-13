'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AlertCircle, TrendingUp, Clock, Bell } from 'lucide-react';
import Link from 'next/link';

interface Metrics {
  totalPolicies: number;
  activePolicies: number;
  expiringSoon: number;
  pendingReminders: number;
  totalCoverageValue: number;
  totalPremiumValue: number;
}

export default function DashboardPage() {
  const supabase = createClientComponentClient();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError('Not authenticated');
          return;
        }

        // Fetch from database directly using client
        const [
          { count: totalCount },
          { count: activeCount },
          { count: expiringCount },
          { count: reminderCount },
          { data: policyData },
        ] = await Promise.all([
          supabase
            .from('policies')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('policies')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'active'),
          supabase
            .from('policies')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'active')
            .gte('coverage_end', new Date().toISOString().split('T')[0])
            .lte(
              'coverage_end',
              new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0]
            ),
          supabase
            .from('reminders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'pending'),
          supabase
            .from('policies')
            .select('premium_amount')
            .eq('user_id', user.id)
            .eq('status', 'active'),
        ]);

        const totalPremium = (policyData || []).reduce((sum, p) => sum + p.premium_amount, 0);

        setMetrics({
          totalPolicies: totalCount || 0,
          activePolicies: activeCount || 0,
          expiringSoon: expiringCount || 0,
          pendingReminders: reminderCount || 0,
          totalCoverageValue: (totalCount || 0) * 1000,
          totalPremiumValue: totalPremium,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetrics();
  }, [supabase]);

  const {
    data: { user },
  } = supabase.auth.getUser();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back!</p>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-md bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      ) : metrics ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-6 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Total Policies</div>
                  <div className="text-3xl font-bold mt-2">{metrics.totalPolicies}</div>
                </div>
                <TrendingUp className="w-8 h-8 text-muted-foreground/50" />
              </div>
            </div>

            <div className="p-6 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Active Policies</div>
                  <div className="text-3xl font-bold mt-2">{metrics.activePolicies}</div>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600/50" />
              </div>
            </div>

            <div className="p-6 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Expiring Soon</div>
                  <div className="text-3xl font-bold mt-2">{metrics.expiringSoon}</div>
                </div>
                <Clock className="w-8 h-8 text-yellow-600/50" />
              </div>
            </div>

            <div className="p-6 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Pending Reminders</div>
                  <div className="text-3xl font-bold mt-2">{metrics.pendingReminders}</div>
                </div>
                <Bell className="w-8 h-8 text-red-600/50" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-6 rounded-lg border bg-card">
              <h3 className="font-semibold mb-4">Premium Value</h3>
              <div className="text-4xl font-bold text-primary">
                ${metrics.totalPremiumValue.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground mt-2">Total annual premiums</p>
            </div>

            <div className="p-6 rounded-lg border bg-card">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link href="/app/policies/new">
                  <button className="w-full p-3 rounded-md border hover:bg-muted text-left text-sm">
                    + Add New Policy
                  </button>
                </Link>
                {metrics.pendingReminders > 0 && (
                  <Link href="/app/reminders">
                    <button className="w-full p-3 rounded-md bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 text-left text-sm">
                      ⚠ {metrics.pendingReminders} pending reminder
                      {metrics.pendingReminders > 1 ? 's' : ''}
                    </button>
                  </Link>
                )}
                <Link href="/app/policies">
                  <button className="w-full p-3 rounded-md border hover:bg-muted text-left text-sm">
                    View All Policies
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
