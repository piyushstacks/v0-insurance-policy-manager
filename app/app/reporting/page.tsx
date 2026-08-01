'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, Clock, ArrowUpRight, Lock, PieChart, ShieldCheck, Building, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTeam } from '@/hooks/use-team';
import { PageLoader } from '@/components/ui/loader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie, Legend } from 'recharts';
import { toast } from 'sonner';

export default function ReportingPage() {
  const { isMember, loading: teamLoading } = useTeam();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!teamLoading && isMember) {
      router.replace('/app/customers');
      return;
    }

    if (teamLoading || isMember) return;

    async function fetchData() {
      try {
        const res = await fetch('/api/dashboard?filter=all');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch data');
        setData(json.data);
      } catch (err: any) {
        toast.error('Error loading reports', { description: err.message });
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [isMember, teamLoading, router]);

  if (isLoading || teamLoading) return <PageLoader words={['reports', 'analytics', 'data']} label="loading" />;

  if (isMember) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center bg-muted transition-colors">
        <div className="w-24 h-24 bg-red-50 rounded-3xl flex items-center justify-center text-red-500 mb-6 shadow-xl shadow-red-100/50 ring-8 ring-white">
          <Lock className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-foreground mb-3 tracking-tight">Access Restricted</h1>
        <p className="text-muted-foreground max-w-md mx-auto mb-8 font-medium">
          The advanced reporting and detailed analysis section is only available to team administrators and owners.
        </p>
        <Link href="/app">
          <Button variant="default" size="lg" className="rounded-xl px-8 shadow-lg shadow-slate-200">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

  const formatCurrency = (val: number) => {
    const rounded = Math.round(val);
    if (rounded >= 10000000) return `₹${(rounded / 10000000).toFixed(2)}Cr`;
    if (rounded >= 100000) return `₹${(rounded / 100000).toFixed(2)}L`;
    return `₹${rounded.toLocaleString('en-IN')}`;
  };

  return (
    <div className="flex flex-col p-4 md:p-8 min-h-full max-w-[1600px] mx-auto w-full pb-24 lg:pb-8 bg-background">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Detailed Analysis</h1>
              <p className="text-muted-foreground font-medium">Comprehensive portfolio and revenue breakdown</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card transition-colors p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Book of Business (AUM)</p>
            <h2 className="text-3xl font-black text-foreground tabular-nums">{formatCurrency(data.totalAUM)}</h2>
          </div>
        </div>
        <div className="bg-card transition-colors p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Annual Premium</p>
            <h2 className="text-3xl font-black text-foreground tabular-nums">{formatCurrency(data.totalPremium)}</h2>
          </div>
        </div>
        <div className="bg-card transition-colors p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Active Policies</p>
            <h2 className="text-3xl font-black text-foreground tabular-nums">{data.activePolicies} / {data.totalPolicies}</h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sector Wise AUM Chart */}
        <div className="bg-card transition-colors rounded-2xl border border-border shadow-sm p-6">
          <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
             Sector Wise Distribution
          </h3>
          <div className="w-full h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={data.sectorAUM}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => percent > 0.05 ? `${name} (${(percent * 100).toFixed(0)}%)` : null}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="aum"
                >
                  {data.sectorAUM.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`} />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Company Distribution */}
        <div className="bg-card transition-colors rounded-2xl border border-border shadow-sm p-6">
          <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
             Top Companies by Premium
          </h3>
          <div className="w-full h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.companyChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                <XAxis type="number" tickFormatter={(val) => `₹${val >= 100000 ? (val/100000).toFixed(1)+'L' : val}`} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={140} 
                  tickFormatter={(val) => val.length > 20 ? val.substring(0, 18) + '...' : val}
                  tick={{fontSize: 11, fill: '#475569'}} 
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '10px', fontSize: '13px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: number) => [`₹${val.toLocaleString('en-IN')}`, 'Premium']}
                />
                <Bar dataKey="premium" radius={[0, 4, 4, 0]} barSize={24} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card transition-colors rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
         <div className="p-5 border-b border-border bg-background">
            <h3 className="text-lg font-bold text-foreground">Customer Premium Analysis</h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
               <thead className="bg-muted transition-colors border-b border-border text-xs uppercase font-bold text-muted-foreground">
                  <tr>
                     <th className="px-6 py-4">Customer Name</th>
                     <th className="px-6 py-4">Total Policies</th>
                     <th className="px-6 py-4 text-right">Total Premium</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {data.customerChartData.map((cust: any, i: number) => (
                     <tr key={i} className="hover:bg-background transition-colors">
                        <td className="px-6 py-4 font-semibold text-foreground">{cust.name}</td>
                        <td className="px-6 py-4 text-foreground/90">
                           <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold">{data.topCustomers.find((t: any) => t.name === cust.name)?.policies || 1}</span>
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-600 text-right tabular-nums">
                           {formatCurrency(cust.premium)}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

    </div>
  );
}
