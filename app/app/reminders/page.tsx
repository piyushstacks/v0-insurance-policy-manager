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
  ChevronDown
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
}

interface Reminder {
  id: string;
  scheduled_date: string;
  reminder_type: string;
  status: 'pending' | 'sent' | 'skipped';
  policies: Policy | null;
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchReminders = async () => {
    try {
      const response = await fetch('/api/reminders');
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `HTTP ${response.status}: Failed to fetch reminders`);
      }
      const data = await response.json();
      setReminders(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reminders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const handleManualSend = async (reminder: Reminder) => {
    const customer = reminder.policies?.customers;
    
    // UI-side validation as requested
    const email = customer?.email?.toLowerCase() || '';
    const isDummyEmail = !email || email.includes('xxxx') || email.includes('dummy') || email.includes('example.com') || email.includes('upload.local');
    const isDummyPhone = !customer?.mobile || customer.mobile.length < 10 || customer.mobile.includes('0000000000');

    if (isDummyEmail) {
      toast.error('Cannot send reminder: Invalid Email', {
        description: 'Customer email contains "xxxx" or is missing. Please update customer profile first.',
      });
      return;
    }

    setSendingId(reminder.id);
    try {
      const res = await fetch(`/api/reminders/${reminder.id}/send`, { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to send reminder');
      
      toast.success('Reminder triggered successfully');
      // Refresh list to show updated status
      fetchReminders();
    } catch (err: any) {
      toast.error('Send Failed', { description: err.message });
    } finally {
      setSendingId(null);
    }
  };

  const getReminderLabel = (type: string) => {
    if (type.includes('30days')) return '30 Day Renewal Notice';
    if (type.includes('15days')) return '15 Day Renewal Notice';
    if (type.includes('7days')) return '7 Day Renewal Notice';
    if (type.includes('3days')) return '3 Day Final Notice';
    if (type.includes('1days')) return '1 Day Urgent Notice';
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

  const groupedPending = useMemo(() => {
    const groups = {
      urgent: [] as Reminder[], // within 7 days
      upcoming: [] as Reminder[], // within 15 days
      scheduled: [] as Reminder[] // 30+ days
    };

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    pendingReminders.forEach(r => {
      const scheduled = new Date(r.scheduled_date);
      scheduled.setHours(0, 0, 0, 0);
      const diffTime = scheduled.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 7) groups.urgent.push(r);
      else if (diffDays <= 15) groups.upcoming.push(r);
      else groups.scheduled.push(r);
    });

    return groups;
  }, [pendingReminders]);

  const renderReminderGroup = (title: string, icon: React.ReactNode, reminders: Reminder[], badgeColor: string) => {
    if (reminders.length === 0) return null;

    return (
      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            {icon}
            {title}
          </h2>
          <span className={`px-2 py-1 ${badgeColor} text-[10px] font-black rounded-md uppercase tracking-wider`}>
            {reminders.length} Alerts
          </span>
        </div>

        <div className="grid gap-4">
          {reminders.map((reminder) => {
            const customer = reminder.policies?.customers;
            const hasInvalidData = isDataInvalid(customer);
            
            return (
              <div key={reminder.id} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden">
                <div className="p-5 flex flex-col sm:flex-row gap-5 items-start">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                    <Bell className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-all" />
                  </div>

                  <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-slate-900 truncate">
                              {customer?.name || 'Unknown Client'}
                          </h3>
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100 uppercase tracking-tight">
                              {getReminderLabel(reminder.reminder_type)}
                          </span>
                      </div>
                      
                      <div className="flex flex-col gap-1.5 mb-4">
                          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span className="flex items-center gap-1.5 font-medium">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  Notify: {new Date(reminder.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </span>
                              <span className="flex items-center gap-1.5">
                                  <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                                  Policy: {reminder.policies?.policy_number}
                              </span>
                              {reminder.policies?.premium_amount && (
                                <span className="flex items-center gap-1.5 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                   ₹{(() => {
                                      const num = reminder.policies?.premium_amount;
                                      if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
                                      if (num >= 100000) return (num / 100000).toFixed(2) + ' Lac';
                                      return num.toLocaleString('en-IN');
                                   })()}
                                </span>
                              )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              <div className={`flex items-center gap-1.5 text-xs ${hasInvalidData ? 'text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100' : 'text-slate-400 font-medium'}`}>
                                  <Mail className="w-3.5 h-3.5 text-slate-300" />
                                  {customer?.email || 'No Email'}
                                  {hasInvalidData && <AlertCircle className="w-3 h-3 ml-1 animate-pulse" />}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                  <Phone className="w-3.5 h-3.5 text-slate-300" />
                                  {customer?.mobile || 'No Phone'}
                              </div>
                          </div>
                      </div>

                      <div className="flex items-center gap-2">
                          <Button 
                              size="sm" 
                              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-9 px-4 shadow-sm"
                              onClick={() => handleManualSend(reminder)}
                              disabled={sendingId === reminder.id}
                          >
                              <Send className={`w-3.5 h-3.5 mr-2 ${sendingId === reminder.id ? 'animate-pulse' : ''}`} />
                              {sendingId === reminder.id ? 'Sending...' : 'Send Reminder Now'}
                          </Button>
                          
                          {hasInvalidData && (
                              <Link href={`/app/customers/${customer?.id}`}>
                                  <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50 rounded-lg h-9">
                                      Update Profile
                                      <ExternalLink className="w-3 h-3 ml-2" />
                                  </Button>
                              </Link>
                          )}
                      </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 max-w-[1600px] mx-auto w-full p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Reminders Queue</h1>
          <p className="text-slate-500 font-medium">Automatic lifecycle alerts for your filtered policy directory</p>
        </div>
        <div className="flex items-center gap-2">
            <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Auto-Sync Active</span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <ReminderSettingsCard />
        </div>

        <div className="lg:col-span-2 space-y-8">
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12">
                <PageLoader words={['reminders', 'schedules', 'alerts', 'notifications']} label="syncing" />
            </div>
          ) : reminders.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <Bell className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">Queue is Empty</h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                No upcoming reminders detected for your active policies. New alerts appear here as policy dates approach.
              </p>
            </div>
          ) : (
            <>
              {renderReminderGroup('Urgent (Next 7 Days)', <AlertCircle className="w-5 h-5 text-red-500" />, groupedPending.urgent, 'bg-red-100 text-red-700')}
              {renderReminderGroup('Upcoming (Next 15 Days)', <Clock className="w-5 h-5 text-amber-500" />, groupedPending.upcoming, 'bg-amber-100 text-amber-700')}
              {renderReminderGroup('Renewal Notices (30+ Days)', <Calendar className="w-5 h-5 text-blue-500" />, groupedPending.scheduled, 'bg-blue-100 text-blue-700')}

              {completedReminders.length > 0 && (
                <div className="pt-8 border-t border-slate-200">
                   <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all">
                      <summary className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 transition-colors list-none">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg group-open:bg-blue-600 group-open:text-white transition-colors">
                               <History className="w-4 h-4" />
                            </div>
                            <div>
                               <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Communication History</h2>
                               <p className="text-[10px] text-slate-400 font-bold uppercase">{completedReminders.length} past logs recorded</p>
                            </div>
                         </div>
                         <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
                      </summary>
                      
                      <div className="p-2 border-t border-slate-100">
                         <div className="overflow-x-auto">
                            <table className="w-full text-left">
                               <thead>
                                  <tr className="border-b border-slate-50">
                                     <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Recipient</th>
                                     <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Reminder Type</th>
                                     <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date & Time</th>
                                     <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Action</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-50">
                                  {completedReminders.map((reminder) => {
                                     const isSent = reminder.status === 'sent';
                                     return (
                                        <tr key={reminder.id} className="hover:bg-slate-50 transition-colors group/row">
                                           <td className="px-4 py-4">
                                              <div className="flex items-center gap-2">
                                                 <span className={`w-2 h-2 rounded-full ${isSent ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                                                 <div>
                                                    <p className="text-sm font-bold text-slate-800 leading-tight">
                                                       {reminder.policies?.customers?.name || 'Unknown'}
                                                    </p>
                                                    <p className="text-[10px] font-medium text-slate-400 truncate max-w-[150px]">
                                                       {reminder.policies?.customers?.email}
                                                    </p>
                                                 </div>
                                              </div>
                                           </td>
                                           <td className="px-4 py-4">
                                              <div className="flex items-center gap-2">
                                                 <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                 <span className="text-xs font-bold text-slate-600">{getReminderLabel(reminder.reminder_type)}</span>
                                              </div>
                                           </td>
                                           <td className="px-4 py-4">
                                              <div className="flex items-center gap-2">
                                                 <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                 <span className="text-[11px] font-medium text-slate-500">
                                                    {new Date(reminder.updated_at || reminder.scheduled_date).toLocaleString('en-IN', { 
                                                       day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                                                    })}
                                                 </span>
                                              </div>
                                           </td>
                                           <td className="px-4 py-4 text-right">
                                              <Link href={`/app/policies/${reminder.policies?.id}`}>
                                                 <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 group-hover/row:opacity-100 opacity-0 transition-all">
                                                    <ExternalLink className="w-4 h-4" />
                                                 </Button>
                                              </Link>
                                           </td>
                                        </tr>
                                     );
                                  })}
                               </tbody>
                            </table>
                         </div>
                      </div>
                   </details>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
