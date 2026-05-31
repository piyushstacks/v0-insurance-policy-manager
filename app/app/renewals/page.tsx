'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/loader';
import {
  CalendarDays,
  Send,
  Eye,
  Search,
  Bell,
  RefreshCw,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface Customer { name: string; email: string; mobile?: string }
interface Insurer { name: string; contact?: string }
interface Policy {
  id: string;
  policy_number: string;
  policy_type: string;
  expiry_date: string;
  premium_amount: number;
  status: string;
  customer?: Customer;
  insurer?: Insurer;
}

export default function RenewalsPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  async function fetchRenewals() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/policies/renewals?days=90`);
      if (!response.ok) throw new Error('Failed to fetch renewals');
      const data = await response.json();
      setPolicies(data.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error loading renewals');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchRenewals();
  }, []);

  const handleSendReminder = async (policyId: string) => {
    setSendingReminder(policyId);
    try {
      // Simulate API call for sending reminder
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Reminder sent successfully!');
    } catch (err: any) {
      toast.error('Failed to send reminder', { description: err.message });
    } finally {
      setSendingReminder(null);
    }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getBadgeStyle = (days: number) => {
    if (days < 0) return 'bg-red-100 text-red-800 border-red-200';
    if (days <= 15) return 'bg-rose-100 text-rose-800 border-rose-200';
    if (days <= 30) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  return (
    <div className="flex flex-col p-4 md:p-8 min-h-full max-w-[1600px] mx-auto w-full pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Renewals</h1>
              <p className="text-slate-500 font-medium">Policies expiring in the next 90 days</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchRenewals} disabled={isLoading} className="bg-white">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Ribbon */}
        <div className="p-4 border-b bg-amber-50/50 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-amber-800 font-semibold">
            <Bell className="w-4 h-4" />
            <span>{policies.length} Upcoming Renewals</span>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto bg-white custom-scrollbar">
          {isLoading ? (
            <PageLoader words={['renewals', 'dates', 'policies', 'customers']} label="loading" />
          ) : policies.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                <CalendarDays className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">No upcoming renewals</h3>
              <p className="text-slate-500 max-w-sm mx-auto">You have no policies expiring in the next 90 days. Everything is up to date!</p>
            </div>
          ) : (
            <div className="w-full min-w-[800px]">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-slate-50 border-b text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3 min-w-[140px]">Customer</th>
                    <th className="px-4 py-3 min-w-[120px]">Policy No</th>
                    <th className="px-4 py-3 min-w-[120px]">Type / Insurer</th>
                    <th className="px-4 py-3 min-w-[100px]">Expiry Date</th>
                    <th className="px-4 py-3 min-w-[100px]">Status</th>
                    <th className="px-4 py-3 text-right w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {policies.map((p) => {
                    const days = getDaysUntilExpiry(p.expiry_date);
                    
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors text-sm group">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 truncate max-w-[160px]">{p.customer?.name || '—'}</div>
                          {p.customer?.mobile && <div className="text-xs text-slate-500 mt-0.5">{p.customer.mobile}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/app/policies/${p.id}`} className="font-medium text-blue-600 hover:underline">
                            {p.policy_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-700 text-xs truncate max-w-[140px] mb-0.5">{p.policy_type?.split(' | ')[0] || '—'}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wide truncate max-w-[140px]">{p.insurer?.name || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 mb-0.5">
                            {new Date(p.expiry_date).toLocaleDateString('en-GB')}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${days < 0 ? 'text-red-600' : days <= 15 ? 'text-rose-600' : 'text-amber-600'}`}>
                              {days < 0 ? `Expired ${Math.abs(days)} days ago` : days === 0 ? 'Expires Today' : `In ${days} days`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getBadgeStyle(days)}`}>
                            {days < 0 ? 'Expired' : 'Expiring Soon'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/app/policies/${p.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="View Policy">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button 
                              size="sm" 
                              className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-3 rounded-lg shadow-sm"
                              onClick={() => handleSendReminder(p.id)}
                              disabled={sendingReminder === p.id}
                            >
                              {sendingReminder === p.id ? (
                                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5 mr-1.5" />
                              )}
                              Remind
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
