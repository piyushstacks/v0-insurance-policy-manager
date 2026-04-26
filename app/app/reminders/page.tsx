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
  Clock
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
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span className="flex items-center gap-1.5 font-medium">
                                  <Calendar className="w-3.5 h-3.5" />
                                  Notify on: {new Date(reminder.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </span>
                              <span className="flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Policy: {reminder.policies?.policy_number}
                              </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
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
          <div className="p-6 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/20 rounded-lg">
                    <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg">System Health</h3>
             </div>
             <p className="text-blue-100 text-sm mb-4">
                Reminders are generated automatically based on policy expiry dates. Ensure customer contact data is accurate for successful delivery.
             </p>
             <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-blue-200">
                    <span>Active Queue</span>
                    <span>{pendingReminders.length} items</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-white h-full" style={{ width: `${Math.min(100, (pendingReminders.length / 20) * 100)}%` }}></div>
                </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
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
                <div className="space-y-4 pt-8 border-t border-slate-200">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-lg font-bold text-slate-400 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-slate-300" />
                        History
                    </h2>
                    <span className="text-xs font-medium text-slate-400">Past 30 days</span>
                  </div>
                  <div className="grid gap-3 opacity-60">
                    {completedReminders.map((reminder) => (
                      <div key={reminder.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 rounded-lg">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-700">{reminder.policies?.customers?.name || 'Unknown'}</p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                    {reminder.status === 'sent' ? 'Delivered' : 'Skipped'} on {new Date(reminder.scheduled_date).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <Link href={`/app/policies/${reminder.policies?.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                                <ExternalLink className="w-4 h-4" />
                            </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
