'use client';

import { useEffect, useState } from 'react';
import { IndianRupee, FileText, Users, TrendingUp, ArrowUpRight, Zap, Target, ShieldAlert, CheckCircle2, ArrowDown, Activity, ShieldCheck, CalendarDays, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTeam } from '@/hooks/use-team';
import { Sparkline } from '@/components/ui/sparkline';
import { SkeletonHero, SkeletonCard, SkeletonRow } from '@/components/ui/skeleton-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { Fab } from '@/components/ui/fab';
import { AIBusinessSummaryCard } from '@/components/dashboard/ai-summary-card';
import { GapDetectionCard } from '@/components/dashboard/gap-detection-card';

import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface BasicDashboardData {
  totalPremiumValue: number;
  totalAUM: number;
  totalPolicies: number;
  activePolicies: number;
  customersCount: number;
  expiringSoon: number;
  sectorAUM: Array<{name: string, aum: number}>;
  sectorAUMTrend: Array<{ period: string; Life: number; Health: number; General: number; }>;
  companyChartData: Array<{name: string, premium: number}>;
  companyAUMTrend: Array<any>;
  top5Companies: string[];
  customerChartData: Array<{name: string, premium: number}>;
}

interface AdvancedDashboardData {
  aum: number;
  aumGrowthMoM: number;
  aumGrowthYoY: number;
  persistency13M: number;
  persistency25M: number;
  topClients: Array<{ id: string; name: string; premium: number }>;
  lapseRiskPolicies: Array<{
    id: string;
    policy_number: string;
    customer_name: string;
    expiry_date: string;
    days_since_last_contact: number;
  }>;
  mdrtProgress: { current: number; mdrt: number; cot: number; tot: number };
}

// Mock sparkline data generated deterministically from a seed
function genSparkline(seed: number, points = 12): number[] {
  return Array.from({ length: points }, (_, i) => {
    const base = seed * 0.00001;
    return Math.max(0, base + base * 0.3 * Math.sin(i * 0.8 + seed * 0.01) + base * 0.1 * i);
  });
}

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)} K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function GrowthPill({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-black px-2 py-0.5 rounded-full ${
      positive ? 'bg-[var(--status-healthy-bg)] text-[var(--status-healthy)]' : 'bg-[var(--status-risk-bg)] text-[var(--status-risk)]'
    }`}>
      {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

function StatusDot({ status }: { status: 'healthy' | 'attention' | 'risk' | 'neutral' }) {
  const cls = {
    healthy:   'bg-[var(--status-healthy)]',
    attention: 'bg-[var(--status-attention)]',
    risk:      'bg-[var(--status-risk)]',
    neutral:   'bg-[var(--status-neutral)]',
  }[status];
  return <span className={`inline-block w-2 h-2 rounded-full ${cls} shrink-0`} />;
}

export default function DashboardPage() {
  const [basicData, setBasicData] = useState<BasicDashboardData | null>(null);
  const [advData, setAdvData] = useState<AdvancedDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [greeting, setGreeting] = useState('Good morning');

  const { isMember, loading: teamLoading } = useTeam();
  const router = useRouter();

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  useEffect(() => {
    if (!teamLoading && isMember) {
      router.replace('/app/customers');
      return;
    }

    if (teamLoading || isMember) return;

    async function fetchMetrics() {
      setIsLoading(true);
      try {
        const [basicRes, advRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/dashboard/advanced'),
        ]);
        const basicJson = await basicRes.json();
        const advJson   = await advRes.json();
        if (!basicRes.ok) throw new Error(basicJson.error);
        if (!advRes.ok)   throw new Error(advJson.error);
        setBasicData(basicJson.data);
        setAdvData(advJson.data);
      } catch (e: any) {
        toast.error('Failed to load dashboard', { description: e.message });
      } finally {
        setIsLoading(false);
      }
    }
    fetchMetrics();
  }, [isMember, teamLoading, router]);

  if (isLoading || teamLoading) {
    return (
      <div className="p-4 md:p-8 space-y-4 max-w-6xl mx-auto">
        <SkeletonHero />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <SkeletonCard key={i} lines={3} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <SkeletonCard lines={5} className="h-40" />
            {[1,2,3].map(i => <SkeletonRow key={i} />)}
          </div>
          <SkeletonCard lines={6} className="h-64" />
        </div>
      </div>
    );
  }

  if (!basicData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-foreground">Failed to load Dashboard</h2>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          There was an error fetching your dashboard data. If you recently updated the app, please ensure you have run the latest SQL migrations in your Supabase project.
        </p>
      </div>
    );
  }

  // Use fallback empty object if advanced data fails or cache is outdated
  const adv = (advData || {}) as AdvancedDashboardData;

  const aum = adv.aum || 0;
  const aumGrowthMoM = adv.aumGrowthMoM || 0;
  const persistency13M = adv.persistency13M || 0;
  const persistency25M = adv.persistency25M || 0;
  const topClients = adv.topClients || ([] as Array<{ id: string; name: string; premium: number }>);
  const lapseRiskPolicies = adv.lapseRiskPolicies || ([] as Array<{ id: string; policy_number: string; customer_name: string; expiry_date: string; days_since_last_contact: number }>);
  
  const mdrtProgress = adv.mdrtProgress || { current: 0, mdrt: 875000, cot: 2625000, tot: 5250000 };
  const sparkData = genSparkline(basicData.totalPremiumValue || 500000);
  const mdrtPct   = Math.min(100, Math.round((mdrtProgress.current / (mdrtProgress.mdrt || 1)) * 100));
  const cotPct    = Math.min(100, Math.round((mdrtProgress.current / (mdrtProgress.cot || 1)) * 100));
  const metrics = [
    { label: 'Active Policies', value: basicData.activePolicies.toString(), isRisk: false, icon: ShieldCheck },
    { label: 'Renewals Due',    value: basicData.expiringSoon?.toString() ?? '—', isRisk: false, icon: CalendarDays },
    { label: 'At-Risk',         value: lapseRiskPolicies.length.toString(), isRisk: lapseRiskPolicies.length > 0, icon: AlertTriangle },
    { label: 'Total Clients',   value: basicData.customersCount.toString(), isRisk: false, icon: Users },
  ];

  return (
    <div className="flex flex-col min-h-full bg-[var(--surface-subtle)] pb-24 lg:pb-12">

      {/* ─── Hero ──────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 pt-5 pb-0">
        <h1 className="text-lg md:text-xl font-serif font-bold text-foreground tracking-tight mb-3">{greeting} 👋</h1>

        {/* Main Metric Hero */}
        <div className="bg-primary rounded-2xl p-5 md:p-7 text-primary-foreground shadow-xl relative overflow-hidden border border-primary/20 transition-colors">
          <div className="absolute inset-0 opacity-5 pointer-events-none select-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[#B38D4F] text-xs font-bold uppercase tracking-widest mb-1">Total AUM</p>
                <h2 className="text-4xl md:text-6xl font-serif tabular-nums tracking-tight leading-none text-white drop-shadow-sm">{fmt(aum)}</h2>
                <div className="mt-2 flex items-center gap-2 bg-primary-foreground/10 px-3 py-1.5 rounded-full inline-flex backdrop-blur-sm border border-primary-foreground/10">
                  <GrowthPill value={adv.aumGrowthMoM || 0} />
                  <span className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wider">vs last month</span>
                </div>
              </div>
              <div className="w-28 md:w-40 h-12 shrink-0 opacity-90">
                <Sparkline data={sparkData} color="blue" height={48} />
              </div>
            </div>

            {/* Secondary metric pills row */}
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 pt-2 snap-x">
              {metrics.map(m => (
                <div key={m.label} className={`shrink-0 rounded-xl px-4 py-3 min-w-[120px] border snap-start ${m.isRisk ? 'bg-destructive border-destructive text-destructive-foreground shadow-lg' : 'bg-primary-foreground/5 border-primary-foreground/10 backdrop-blur text-primary-foreground/90'}`}>
                  <div className="flex items-center gap-1.5 mb-1 text-inherit">
                    {m.icon && <m.icon className="w-3.5 h-3.5 opacity-80" />}
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${m.isRisk ? 'text-destructive-foreground/80' : 'text-primary-foreground/60'}`}>{m.label}</p>
                  </div>
                  <p className="font-serif text-lg font-bold tracking-tight">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AUM Breakdown Mini */}
      {basicData.sectorAUM && basicData.sectorAUM.length > 0 && (
        <div className="px-4 md:px-8 mt-4">
          <div className="bg-card rounded-xl shadow-sm border border-border p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors">
            <div className="w-full md:w-1/3 shrink-0">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Business Mix</span>
                <span className="text-xs font-bold text-muted-foreground/70">100%</span>
              </div>
              <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted">
                {basicData.sectorAUM.map((s, idx) => (
                  <div 
                    key={s.name} 
                    style={{ 
                      width: `${(s.aum / (basicData.totalAUM || 1)) * 100}%`,
                      backgroundColor: `var(--chart-${idx + 1})`
                    }} 
                    className="h-full first:rounded-l-full last:rounded-r-full border-r border-white/20 last:border-0 transition-all"
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-4 shrink-0">
              {basicData.sectorAUM.map((s, idx) => (
                <div key={s.name} className="flex flex-col">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `var(--chart-${idx + 1})` }} />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{s.name}</span>
                  </div>
                  <span className="text-xs font-serif font-bold text-foreground tabular-nums">{((s.aum / (basicData.totalAUM || 1)) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Body ─────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 mt-5 space-y-5 max-w-6xl mx-auto w-full">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
           <div className="lg:col-span-2">
              <AIBusinessSummaryCard />
           </div>
           <div className="lg:col-span-1 h-full min-h-[300px]">
              <GapDetectionCard />
           </div>
        </div>

        {/* Main Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card rounded-3xl shadow-sm border border-border p-6 flex flex-col transition-colors">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Portfolio Diversification</h3>
              <Activity className="w-4 h-4 text-muted-foreground/50" />
            </div>
            <p className="text-xs font-medium text-muted-foreground/70 mb-6">AUM distribution by insurance sector</p>

            <div className="flex-1 w-full flex flex-col">
              {(!basicData.sectorAUM || basicData.sectorAUM.length === 0) ? (
                <EmptyState icon={FileText} title="No sector data" description="Add policies to see trends." />
              ) : (
                <>
                  <div className="flex justify-center mt-6 flex-wrap gap-4 px-4">
                      {basicData.sectorAUM.map((s: any, idx: number) => (
                        <div key={s.name} className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `var(--chart-${idx + 1})` }} />
                          {s.name}
                        </div>
                    ))}
                  </div>
                  
                  <div className="flex-1 min-h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={basicData.sectorAUM} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} width={70} />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          formatter={(value: number) => [fmt(value), 'Sum Assured']}
                          contentStyle={{ backgroundColor: '#0B1B3D', borderRadius: '8px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px', color: '#fff' }}
                          itemStyle={{ fontSize: '13px', paddingTop: '4px', fontWeight: 600, color: '#fff' }}
                          labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                        />
                        <Bar dataKey="aum" radius={[0, 4, 4, 0]} barSize={28}>
                          {basicData.sectorAUM.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`var(--chart-${index + 1})`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-card rounded-3xl shadow-sm border border-border p-6 flex-1 flex flex-col transition-colors">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" /> High Net Worth Ledger
                </h3>
                <Link href="/app/customers" className="text-[10px] font-bold text-primary hover:text-primary/80 bg-primary/10 px-3 py-1 rounded-full transition-colors uppercase tracking-wide">View all</Link>
              </div>

              <div className="flex-1 w-full">
                {(!adv.topClients || adv.topClients.length === 0) ? (
                  <EmptyState icon={Users} title="No client data" description="Add customers to see clients." />
                ) : (
                  <div className="flex flex-col gap-3">
                    {adv.topClients.slice(0, 5).map((client: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-accent transition-colors border border-transparent hover:border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-muted-foreground font-bold font-serif text-sm border border-border">
                            {client.name.substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground leading-none mb-1">{client.name.length > 20 ? client.name.substring(0, 20) + '...' : client.name}</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Top Client</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-serif font-bold text-foreground">{fmt(client.total_aum || client.premium || 0)}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total AUM</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>
        </div>
      </div>

      <Fab />
    </div>
  );
}
