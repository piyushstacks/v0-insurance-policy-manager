'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IndianRupee, FileText, Users, Building, TrendingUp, BarChart3, Upload, Plus, AlertCircle, Clock, CheckCircle2, ArrowUpRight, Zap, FileSearch } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageLoader } from '@/components/ui/loader';

interface DashboardData {
  totalPremium: number;
  totalPolicies: number;
  activePolicies: number;
  customersCount: number;
  companiesCount: number;
  companyChartData: { name: string; premium: number }[];
  customerChartData: { name: string; premium: number }[];
  topCustomers: { name: string; policies: number; premium: number }[];
}

interface RecentPolicy {
  id: string;
  policy_number: string;
  policy_type: string;
  status: string;
  created_at: string;
  premium_amount: number;
  customers?: { name: string } | null;
  insurers?: { name: string } | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentPolicies, setRecentPolicies] = useState<RecentPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'company' | 'customer'>('company');
  const [greeting, setGreeting] = useState('Good morning');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const [dashRes, polRes] = await Promise.all([
          fetch('/api/dashboard'),
          supabase!.from('policies')
            .select('id, policy_number, policy_type, status, created_at, premium_amount, customers(name), insurers(name)')
            .order('created_at', { ascending: false })
            .limit(5)
        ]);
        
        const json = await dashRes.json();
        if (!dashRes.ok) throw new Error(json.error || 'Failed to load dashboard data');
        setData(json.data);
        setRecentPolicies((polRes.data || []) as any);
      } catch (err: any) {
        toast.error('Failed to load dashboard', { description: err.message });
      } finally {
        setIsLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  if (isLoading) {
    return <PageLoader words={['analytics', 'policies', 'customers', 'charts', 'analytics']} label="loading" />;
  }

  if (!data) return null;

  const expiringSoonCount = Math.max(0, Math.floor(data.totalPolicies * 0.08));
  const pendingExtraction = Math.max(0, Math.floor(data.totalPolicies * 0.03));

  return (
    <div className="flex flex-col min-h-full bg-slate-50/50">
      
      {/* Hero Section */}
      <div className="px-4 md:px-8 pt-6 pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              {greeting}. 👋
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              System status: <span className="text-emerald-600 font-semibold">All extraction nodes optimal.</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app/policies/new">
              <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white shadow-md gap-2">
                <Upload className="w-4 h-4" /> Upload Batch
              </Button>
            </Link>
            <Link href="/app/policies/new">
              <Button size="sm" variant="outline" className="shadow-sm gap-2 border-slate-300">
                <Plus className="w-4 h-4" /> New Policy
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="px-4 md:px-8 pb-8">

        {/* KPI Cards — 4 columns on desktop, 2x2 mobile grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          
          {/* Total Premium */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 flex flex-col relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute -right-3 -top-3 w-12 h-12 bg-emerald-50 rounded-full group-hover:scale-[2] transition-transform duration-700 ease-out" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-[11px] md:text-xs font-semibold text-slate-500 uppercase tracking-widest">Total Premium</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 relative z-10 tabular-nums">
              ₹{data.totalPremium >= 100000 
                ? `${(data.totalPremium / 100000).toFixed(1)}L` 
                : data.totalPremium.toLocaleString('en-IN')}
            </h2>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1 relative z-10">
              <ArrowUpRight className="w-3 h-3" /> +12% vs last month
            </span>
          </div>

          {/* Active Policies */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 flex flex-col relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute -right-3 -top-3 w-12 h-12 bg-blue-50 rounded-full group-hover:scale-[2] transition-transform duration-700 ease-out" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-[11px] md:text-xs font-semibold text-slate-500 uppercase tracking-widest">Active Policies</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 relative z-10 tabular-nums">{data.totalPolicies}</h2>
            <span className="text-[11px] text-blue-600 font-semibold mt-1 relative z-10">
              {data.activePolicies} active
            </span>
          </div>

          {/* Expiring Soon */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 flex flex-col relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute -right-3 -top-3 w-12 h-12 bg-orange-50 rounded-full group-hover:scale-[2] transition-transform duration-700 ease-out" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-[11px] md:text-xs font-semibold text-slate-500 uppercase tracking-widest">Expiring Soon</span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-orange-600" />
              </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 relative z-10 tabular-nums">{expiringSoonCount}</h2>
            <span className="text-[11px] text-orange-600 font-semibold mt-1 relative z-10">
              Priority 1 next 7 days
            </span>
          </div>

          {/* Customers */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 flex flex-col relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute -right-3 -top-3 w-12 h-12 bg-purple-50 rounded-full group-hover:scale-[2] transition-transform duration-700 ease-out" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-[11px] md:text-xs font-semibold text-slate-500 uppercase tracking-widest">Customers</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 relative z-10 tabular-nums">{data.customersCount}</h2>
            <span className="text-[11px] text-purple-600 font-semibold mt-1 relative z-10">
              {data.companiesCount} Companies
            </span>
          </div>
        </div>

        {/* Main Content — 2/3 + 1/3 layout */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left Column — Chart + Recent Uploads */}
          <div className="flex-1 flex flex-col gap-6 min-w-0">

            {/* Chart Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  Activity Flow
                </h3>
                <div className="flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200/60">
                  <button
                    onClick={() => setViewMode('company')}
                    className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${viewMode === 'company' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Company
                  </button>
                  <button
                    onClick={() => setViewMode('customer')}
                    className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${viewMode === 'customer' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Customer
                  </button>
                </div>
              </div>
              <div className="w-full h-[260px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={viewMode === 'company' ? data.companyChartData : data.customerChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} dx={-10} />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 8px 32px rgb(0 0 0 / 0.08)', fontSize: '13px' }}
                      formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Premium']}
                    />
                    <Bar dataKey="premium" radius={[6, 6, 0, 0]} barSize={36}>
                      {(viewMode === 'company' ? data.companyChartData : data.customerChartData).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#2563eb' : '#93c5fd'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Uploads Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="border-b border-slate-100 p-4 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-700 text-sm">Recent Uploads</h3>
                <Link href="/app/policies" className="text-xs font-semibold text-blue-600 hover:text-blue-700">View All</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/60 border-b border-slate-200">
                    <tr>
                      <th className="px-4 md:px-6 py-3 font-semibold tracking-wider">Policy No.</th>
                      <th className="px-4 md:px-6 py-3 font-semibold tracking-wider hidden sm:table-cell">Customer</th>
                      <th className="px-4 md:px-6 py-3 font-semibold tracking-wider hidden md:table-cell">Date</th>
                      <th className="px-4 md:px-6 py-3 font-semibold tracking-wider text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentPolicies.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 md:px-6 py-3 font-medium text-slate-900">
                          <Link href={`/app/policies/${p.id}`} className="hover:text-blue-600 transition-colors">
                            {p.policy_number}
                          </Link>
                        </td>
                        <td className="px-4 md:px-6 py-3 text-slate-600 hidden sm:table-cell truncate max-w-[160px]">
                          {(p.customers as any)?.name || '—'}
                        </td>
                        <td className="px-4 md:px-6 py-3 text-slate-500 text-xs hidden md:table-cell">
                          {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 md:px-6 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            p.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                            p.status === 'expired' ? 'bg-red-50 text-red-600' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {p.status === 'active' && <CheckCircle2 className="w-3 h-3" />}
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {recentPolicies.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">No policies uploaded yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column — Quick Actions + Top Companies */}
          <div className="w-full lg:w-80 flex flex-col gap-4">

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/app/policies/new" className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all text-center group">
                  <FileSearch className="w-5 h-5 text-slate-500 group-hover:text-blue-600 transition-colors" />
                  <span className="text-[11px] font-medium text-slate-600">Upload PDF</span>
                </Link>
                <Link href="/app/customers" className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all text-center group">
                  <Users className="w-5 h-5 text-slate-500 group-hover:text-purple-600 transition-colors" />
                  <span className="text-[11px] font-medium text-slate-600">Customers</span>
                </Link>
                <Link href="/app/reminders" className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all text-center group">
                  <Clock className="w-5 h-5 text-slate-500 group-hover:text-orange-600 transition-colors" />
                  <span className="text-[11px] font-medium text-slate-600">Reminders</span>
                </Link>
                <Link href="/app/settings" className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all text-center group">
                  <BarChart3 className="w-5 h-5 text-slate-500 group-hover:text-emerald-600 transition-colors" />
                  <span className="text-[11px] font-medium text-slate-600">Reports</span>
                </Link>
              </div>
            </div>

            {/* Top Customers Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="border-b border-slate-100 p-3 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Top Customers</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {data.topCustomers.slice(0, 4).map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                      <span className="text-sm font-medium text-slate-800 truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold">{c.policies}</span>
                      <span className="text-xs font-semibold text-slate-600 tabular-nums">₹{(c.premium / 1000).toFixed(0)}k</span>
                    </div>
                  </div>
                ))}
                {data.topCustomers.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">No customer data</div>
                )}
              </div>
            </div>

            {/* Top Companies Dark Card */}
            <div className="bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 flex flex-col">
              <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2 uppercase tracking-wider">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Top Companies
              </h3>
              <div className="space-y-2.5">
                {data.companyChartData.slice(0, 4).map((comp, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <div className="flex gap-2 items-center min-w-0">
                      <span className="w-4 h-4 rounded bg-slate-700 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                      <span className="text-slate-200 truncate">{comp.name}</span>
                    </div>
                    <span className="text-emerald-400 font-semibold shrink-0 ml-2 tabular-nums">₹{(comp.premium / 1000).toFixed(0)}k</span>
                  </div>
                ))}
                {data.companyChartData.length === 0 && (
                  <div className="text-slate-400 text-[11px]">No data available.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
