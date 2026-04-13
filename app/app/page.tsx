'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IndianRupee, FileText, Users, Building, TrendingUp, Filter, BarChart3, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';

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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fake UI state for the top toggles to mock the reference design
  const [viewMode, setViewMode] = useState<'company' | 'customer'>('company');

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch('/api/dashboard');
        const json = await res.json();
        
        if (!res.ok) throw new Error(json.error || 'Failed to load dashboard data');

        setData(json.data);
      } catch (err: any) {
        toast.error('Failed to load dashboard', { description: err.message });
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* Top Toolbar (Mimicking Reference Image Controls) */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 md:px-8 border-b bg-white">
        <div className="flex flex-wrap items-center gap-2">
           <select className="h-9 px-3 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 outline-none">
             <option>2026-2027</option>
             <option>2025-2026</option>
           </select>
           <select className="h-9 px-3 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 outline-none">
             <option>YTD</option>
             <option>Q1</option>
             <option>Q2</option>
           </select>
           <div className="flex items-center p-1 bg-slate-100 rounded-md ml-2 border border-slate-200/60">
              <button 
                onClick={() => setViewMode('company')}
                className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${viewMode === 'company' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Company Wise
              </button>
              <button 
                onClick={() => setViewMode('customer')}
                className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all ${viewMode === 'customer' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Customer Wise
              </button>
           </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
           <Link href="/app/policies/new" className="w-full md:w-auto">
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                 + Add New Policy
              </Button>
           </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-slate-400 font-medium flex items-center gap-2">
            <BarChart3 className="w-5 h-5 animate-pulse" /> Loading Analytics...
          </div>
        </div>
      ) : data ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          
          <div className="flex flex-col xl:flex-row gap-6">
            
            {/* Left Column: Big Chart & Bottom Table */}
            <div className="flex-1 flex flex-col gap-6 w-full">
              
              {/* Chart Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col h-[400px]">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  {viewMode === 'company' ? 'Company Wise Distribution' : 'Customer Wise Distribution'}
                </h3>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={viewMode === 'company' ? data.companyChartData : data.customerChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis 
                         dataKey="name" 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fill: '#64748b', fontSize: 12 }} 
                         dy={10}
                      />
                      <YAxis 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fill: '#94a3b8', fontSize: 12 }} 
                         tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                         dx={-10}
                      />
                      <Tooltip 
                         cursor={{ fill: '#f1f5f9' }}
                         contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                         formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Premium']}
                      />
                      <Bar 
                        dataKey="premium" 
                        radius={[4, 4, 0, 0]} 
                        barSize={40}
                      >
                         {
                           (viewMode === 'company' ? data.companyChartData : data.customerChartData).map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={index === 0 ? '#2563eb' : '#60a5fa'} />
                           ))
                         }
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bottom Table Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
                 <div className="border-b border-slate-100 p-4 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Top Customers Details</h3>
                 </div>
                 <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                       <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
                          <tr>
                             <th className="px-6 py-4 font-semibold tracking-wider">Customer Name</th>
                             <th className="px-6 py-4 font-semibold tracking-wider text-center">Policies (NoP)</th>
                             <th className="px-6 py-4 font-semibold tracking-wider text-right">Premium (₹)</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {data.topCustomers.map((c, i) => (
                             <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900">{c.name}</td>
                                <td className="px-6 py-4 text-center">
                                   <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-bold text-xs">
                                     {c.policies}
                                   </span>
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-slate-700">
                                   ₹{c.premium.toLocaleString('en-IN')}
                                </td>
                             </tr>
                          ))}
                          {data.topCustomers.length === 0 && (
                             <tr>
                               <td colSpan={3} className="px-6 py-8 text-center text-slate-400">No customer data available</td>
                             </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
            </div>

            {/* Right Column: KPI Cards */}
            <div className="w-full xl:w-80 flex flex-col gap-4">
              
              {/* Card 1 */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden group">
                 <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
                 <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1 relative z-10 flex items-center gap-1.5 justify-center">
                   <IndianRupee className="w-3.5 h-3.5" /> Total Premium
                 </p>
                 <h2 className="text-3xl font-black text-slate-800 relative z-10">
                   ₹{data.totalPremium.toLocaleString('en-IN')}
                 </h2>
              </div>

              {/* Card 2 */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden group">
                 <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
                 <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1 relative z-10 flex items-center gap-1.5 justify-center">
                   <FileText className="w-3.5 h-3.5" /> Total Policies
                 </p>
                 <h2 className="text-3xl font-black text-slate-800 relative z-10">
                   {data.totalPolicies}
                 </h2>
              </div>

              {/* Card 3 */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden group">
                 <div className="absolute -right-4 -top-4 w-16 h-16 bg-purple-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
                 <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1 relative z-10 flex items-center gap-1.5 justify-center">
                   <Users className="w-3.5 h-3.5" /> Customers
                 </p>
                 <h2 className="text-3xl font-black text-slate-800 relative z-10">
                   {data.customersCount}
                 </h2>
              </div>

              {/* Card 4 */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden group">
                 <div className="absolute -right-4 -top-4 w-16 h-16 bg-orange-50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
                 <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1 relative z-10 flex items-center gap-1.5 justify-center">
                   <Building className="w-3.5 h-3.5" /> Companies
                 </p>
                 <h2 className="text-3xl font-black text-slate-800 relative z-10">
                   {data.companiesCount}
                 </h2>
              </div>

              {/* Mini Standings Board */}
              <div className="bg-slate-800 p-5 rounded-xl shadow-lg border border-slate-700 flex flex-col mt-2">
                 <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
                   <TrendingUp className="w-4 h-4 text-emerald-400" /> Top Companies
                 </h3>
                 <div className="space-y-3">
                    {data.companyChartData.slice(0,3).map((comp, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                         <div className="flex gap-2 items-center min-w-0">
                            <span className="w-5 h-5 rounded bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">{i+1}</span>
                            <span className="text-slate-200 truncate">{comp.name}</span>
                         </div>
                         <span className="text-emerald-400 font-medium shrink-0 ml-2">₹{(comp.premium / 1000).toFixed(0)}k</span>
                      </div>
                    ))}
                    {data.companyChartData.length === 0 && (
                      <div className="text-slate-400 text-xs">No analytics available.</div>
                    )}
                 </div>
              </div>

            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
