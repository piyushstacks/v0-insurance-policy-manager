'use client';

import { useEffect, useState } from 'react';
import { Bell, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Reminder {
  id: string;
  scheduled_date: string;
  reminder_type: 'renewal_30days' | 'renewal_7days' | 'premium_due' | 'followup';
  status: 'pending' | 'sent' | 'skipped';
  policies?: {
    id: string;
    policy_number: string;
    policy_type: string;
    coverage_end: string;
  };
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function fetchReminders() {
      try {
        const response = await fetch('/api/reminders');
        if (!response.ok) throw new Error('Failed to fetch reminders');
        const data = await response.json();
        setReminders(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reminders');
      } finally {
        setIsLoading(false);
      }
    }

    fetchReminders();
  }, []);

  const pendingReminders = reminders.filter((r) => r.status === 'pending');
  const completedReminders = reminders.filter((r) => r.status !== 'pending');

  return (
    <div className="p-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Reminders</h1>
        <p className="text-muted-foreground">Policy renewal and payment reminders</p>
      </div>

      {error && (
        <div className="mb-4 mt-4 p-4 rounded-md bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading reminders...</p>
        </div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-dashed bg-muted/50 mt-8">
          <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No reminders</h3>
          <p className="text-muted-foreground">Reminders will appear here when policies are set</p>
        </div>
      ) : (
        <div className="space-y-6 mt-8">
          {pendingReminders.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Pending</h2>
              <div className="space-y-3">
                {pendingReminders.map((reminder) => (
                  <div key={reminder.id} className="p-4 rounded-lg border bg-yellow-50 border-yellow-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h3 className="font-semibold">
                            {reminder.policies?.policy_number}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {reminder.reminder_type.includes('renewal') ? 'Policy renewal' : 'Action required'} due{' '}
                            {new Date(reminder.scheduled_date).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Expires: {new Date(reminder.policies?.coverage_end || '').toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View Policy
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedReminders.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Completed</h2>
              <div className="space-y-3">
                {completedReminders.map((reminder) => (
                  <div key={reminder.id} className="p-4 rounded-lg border bg-gray-50 opacity-75">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-700">
                          {reminder.policies?.policy_number}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {reminder.status === 'sent' ? 'Sent' : 'Skipped'} on{' '}
                          {new Date(reminder.scheduled_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
