'use client';

import { Sparkles, ArrowRight, UserPlus, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface CustomerGapDetectionProps {
  policies: any[];
}

export function CustomerGapDetection({ policies }: CustomerGapDetectionProps) {
  // 1. Calculate Active Policy Types
  const activePolicies = policies.filter(p => ['active', 'renewed'].includes(p.status));
  const activeTypes = new Set(activePolicies.map(p => p.insurance_type?.toLowerCase()).filter(Boolean));
  
  // Cross-sell logic: If they have at least 1 policy, find missing standard types
  const allTypes = ['life', 'health', 'motor']; // 'commercial' or 'general' usually grouped
  const missingTypes = allTypes.filter(t => !activeTypes.has(t));
  
  // 2. Calculate At-Risk / Upcoming Renewals (next 30 days)
  const next30Days = new Date();
  next30Days.setDate(next30Days.getDate() + 30);
  
  const atRisk = activePolicies.filter(p => {
    if (!p.expiry_date) return false;
    const expiry = new Date(p.expiry_date);
    return expiry <= next30Days && expiry >= new Date(new Date().setHours(0,0,0,0));
  }).map(p => {
    const daysToExpiry = Math.ceil((new Date(p.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    return { ...p, daysToExpiry };
  }).sort((a, b) => a.daysToExpiry - b.daysToExpiry);

  if (activePolicies.length === 0) {
    return null; // Don't show gap detection for prospects with zero active policies yet
  }

  return (
    <Card className="rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm overflow-hidden bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-background">
      <CardHeader className="border-b border-indigo-50 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-950/20 py-3.5">
        <CardTitle className="text-sm font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          AI Gap Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
          
          {/* Cross Sell */}
          <div className="p-4">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Cross-Sell Opportunities</h4>
            {missingTypes.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-foreground/90 font-medium">
                  Client only has <span className="text-indigo-600 dark:text-indigo-400 font-bold">{Array.from(activeTypes).join(', ')}</span> cover.
                </p>
                <div className="flex flex-wrap gap-2">
                  {missingTypes.map(type => (
                    <Button key={type} variant="outline" size="sm" className="h-7 text-[10px] font-bold border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 rounded-lg capitalize">
                      Pitch {type} <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-bold">Client is fully covered across all core sectors.</span>
              </div>
            )}
          </div>

          {/* At Risk */}
          <div className="p-4">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Upcoming Renewals</h4>
            {atRisk.length > 0 ? (
              <ul className="space-y-3">
                {atRisk.map((p, i) => (
                  <li key={i} className="flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-lg p-2 px-3">
                    <div>
                      <p className="text-xs font-bold text-foreground capitalize">{p.insurance_type || 'Policy'} • {p.policy_number}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">Expires in {p.daysToExpiry} days</span>
                      </div>
                    </div>
                    <Link href={`/app/policies/${p.id}`} prefetch={true}>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/50">
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground font-medium italic mt-2">No renewals due in the next 30 days.</p>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
