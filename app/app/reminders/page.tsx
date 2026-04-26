'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  Bell, 
  AlertCircle, 
  CheckCircle, 
  Mail, 
  Phone, 
  Send, 
  User, 
  Calendar,
  ExternalLink,
  ShieldAlert,
  Clock,
  History,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/loader';
import { ReminderSettingsCard } from '@/components/settings/reminder-settings-card';
import { toast } from 'sonner';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
}

interface Insurer {
  name: string;
}

interface Policy {
  id: string;
  policy_number: string;
  policy_type: string;
  expiry_date: string;
  customers: Customer | null;
  insurers: Insurer | null;
  premium_amount: number | null;
}

interface Reminder {
  id: string;
  scheduled_date: string;
  reminder_type: string;
  status: 'pending' | 'sent' | 'skipped';
  updated_at?: string | null;
  policies: Policy | null;
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<{ timing_days: number[] } | null>(null);

  const fetchData = async () => {
    try {
      const [remRes, prefRes] = await Promise.all([
        fetch('/api/reminders'),
        fetch('/api/user/reminders')
      ]);

      if (remRes.ok) {
        const remData = await remRes.json();
        setReminders(remData.data || []);
      }

      if (prefRes.ok) {
        const prefData = await prefRes.json();
        if (prefData.preferences) setPrefs(prefData.preferences);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleManualSend = async (policy: Policy) => {
    const customer = policy?.customers;
    
    // UI-side validation as requested
    const email = customer?.email?.toLowerCase() || '';
    const isDummyEmail = !email || email.includes('xxxx') || email.includes('dummy') || email.includes('example.com') || email.includes('upload.local');

    if (isDummyEmail) {
      toast.error('Cannot send reminder: Invalid Email', {
        description: 'Customer email contains "xxxx" or is missing. Please update customer profile first.',
      });
      return;
    }

    setSendingId(policy.id);
    try {
      const res = await fetch(`/api/policies/${policy.id}/send`, { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to send notification');
      
      toast.success('Ad-hoc notification sent successfully');
      // No need to refresh data since it doesn't affect automated journey statuses
    } catch (err: any) {
      toast.error('Send Failed', { description: err.message });
    } finally {
      setSendingId(null);
    }
  };

  const getReminderLabel = (type: string) => {
    const match = type.match(/(\d+)days/);
    if (match) return `${match[1]} Day Renewal Notice`;
    return 'Policy Reminder';
  };

  const isDataInvalid = (customer: Customer | null | undefined) => {
    const email = customer?.email?.toLowerCase() || '';
    return !email || email.includes('xxxx') || email.includes('dummy') || email.includes('example.com') || email.includes('upload.local');
  };

  const pendingReminders = useMemo(() => 
    reminders.filter((r) => r.status === 'pending'),
  [reminders]);

  const completedReminders = useMemo(() => 
    reminders.filter((r) => r.status !== 'pending'),
  [reminders]);

  const policyLifecycle = useMemo(() => {
    const groups: Record<string, { policy: Policy; reminders: Reminder[] }> = {};
    
    reminders.forEach(r => {
      if (!r.policies) return;
      const policyId = r.policies.id;
      if (!groups[policyId]) {
        groups[policyId] = { policy: r.policies, reminders: [] };
      }
      groups[policyId].reminders.push(r);
    });
    
    // Sort groups by the earliest PENDING reminder, or if none, by last UPDATED
    return Object.values(groups).sort((a, b) => {
      const aPending = a.reminders.find(r => r.status === 'pending');
      const bPending = b.reminders.find(r => r.status === 'pending');
      
      if (aPending && bPending) {
        return new Date(aPending.scheduled_date).getTime() - new Date(bPending.scheduled_date).getTime();
      }
      if (aPending) return -1;
      if (bPending) return 1;
      return 0;
    });
  }, [reminders]);

  const lifecycleStages = useMemo(() => {
    const days = prefs?.timing_days || [30, 15, 7, 3, 1];
    return [...days]
      .sort((a, b) => b - a)
      .map(d => ({
        type: `renewal_${d}days`,
        label: `${d}d`
      }));
  }, [prefs]);

  return (
    <div className="flex flex-col h-full bg-slate-50 max-w-[1600px] mx-auto w-full p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Lifecycle Manager</h1>
          <p className="text-slate-500 font-medium">Policy preservation journey and automated touchpoints</p>
        </div>
        <div className="flex items-center gap-2">
            <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Engine Active</span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <ReminderSettingsCard onSave={fetchData} />
        </div>

        <div className="lg:col-span-2 space-y-6">
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12">
                <PageLoader words={['cycles', 'journeys', 'policies', 'reminders']} label="mapping" />
            </div>
          ) : policyLifecycle.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <Bell className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">No Active Journeys</h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                Once policies are added, their automated lifecycle touchpoints will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {policyLifecycle.map(({ policy, reminders: policyReminders }) => {
                const customer = policy.customers;
                const nextPending = policyReminders.find(r => r.status === 'pending');
                const hasInvalidData = isDataInvalid(customer);

                return (
                  <div key={policy.id} className="bg-white rounded-[24px] border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Left: Client Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                           <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold">
                              {customer?.name?.charAt(0).toUpperCase() || '?'}
                           </div>
                           <div>
                              <h3 className="font-extrabold text-slate-900 truncate leading-none mb-1 text-lg">
                                 {customer?.name || 'Unknown Client'}
                              </h3>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 w-fit px-1.5 rounded">
                                 Policy: {policy.policy_number}
                              </p>
                           </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mb-4 ml-1">
                           <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              Expiry: {new Date(policy.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                           </span>
                           {policy.premium_amount && (
                              <span className="font-bold text-slate-700">
                                 ₹{(() => {
                                    const num = policy.premium_amount;
                                    if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
                                    if (num >= 100000) return (num / 100000).toFixed(2) + ' Lac';
                                    return num.toLocaleString('en-IN');
                                 })()}
                              </span>
                           )}
                           <div className="flex items-center gap-3">
                              <Mail className="w-3.5 h-3.5 text-slate-300" />
                              <span className={hasInvalidData ? 'text-red-500 font-bold' : ''}>{customer?.email || 'Missing'}</span>
                           </div>
                        </div>

                        <div className="mt-6">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Communication Journey</p>
                           <div className="relative flex items-center justify-between max-w-sm">
                              <div className="absolute left-0 right-0 h-0.5 bg-slate-100 z-0"></div>
                              {lifecycleStages.map((stage) => {
                                 const reminder = policyReminders.find(r => r.reminder_type === stage.type);
                                 const isSent = reminder?.status === 'sent';
                                 
                                 // Determine the first pending chronologically for 'Due' vs 'Wait'
                                 const firstPending = lifecycleStages.find(s => {
                                    const r = policyReminders.find(pr => pr.reminder_type === s.type);
                                    return r?.status === 'pending' || !r; 
                                 });
                                 const isPending = reminder?.status === 'pending' || !reminder;
                                 const isDue = isPending && stage.type === firstPending?.type;
                                 const isWait = isPending && !isDue;

                                 return (
                                    <div key={stage.type} className="relative z-10 flex flex-col items-center">
                                       <div 
                                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                                             isSent ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' :
                                             isDue ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100 scale-110' :
                                             'bg-blue-50 border-blue-300 text-blue-600'
                                          }`}
                                          title={`${stage.label} reminder: ${reminder?.status || 'Active'}`}
                                       >
                                          {isSent ? <CheckCircle className="w-4 h-4" /> : <span className="text-[10px] font-black">{stage.label}</span>}
                                       </div>
                                       <span className={`text-[9px] font-bold mt-2 uppercase tracking-tighter ${isSent ? 'text-emerald-600' : isDue ? 'text-blue-600' : 'text-slate-400'}`}>
                                          {isSent ? (reminder?.updated_at ? new Date(reminder.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Sent') : isDue ? 'Due' : 'Wait'}
                                       </span>
                                    </div>
                                 );
                              })}
                           </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-col justify-between items-center sm:items-end min-w-[140px] border-l border-dashed border-slate-100 pl-6">
                        <div className="text-right">
                           {nextPending ? (
                              <div className="mb-4">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Due Next</p>
                                 <p className="text-xs font-bold text-slate-800">{getReminderLabel(nextPending.reminder_type)}</p>
                                 <p className="text-[10px] text-blue-600 font-bold">{new Date(nextPending.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                              </div>
                           ) : (
                              <div className="mb-4 bg-emerald-50 px-2 py-1 rounded text-emerald-600 text-[10px] font-black uppercase">
                                 All Clear
                              </div>
                           )}
                        </div>

                        <div className="flex flex-col gap-2 w-full">
                           <Button 
                              size="sm" 
                              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 w-full font-bold text-[11px]"
                              onClick={() => handleManualSend(policy)}
                              disabled={sendingId === policy.id}
                           >
                              {sendingId === policy.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-2" />}
                              {sendingId === policy.id ? 'Sending...' : 'Send Notification'}
                           </Button>
                           <Link href={`/app/policies/${policy.id}`} className="w-full">
                              <Button variant="ghost" size="sm" className="h-10 w-full rounded-xl text-slate-500 hover:bg-slate-50 font-bold text-[11px] gap-2">
                                 View Details
                                 <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                           </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
