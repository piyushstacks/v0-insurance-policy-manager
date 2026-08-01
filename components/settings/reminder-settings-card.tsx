'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Bell, Mail, Clock, Save, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ReminderPreferences {
  enabled: boolean;
  email: boolean;
  timing_days: number[];
  types: string[];
}

export function ReminderSettingsCard({ onSave }: { onSave?: () => void }) {
  const defaultPrefs: ReminderPreferences = {
    enabled: true,
    email: true,
    timing_days: [7, 15, 30],
    types: ['renewal', 'premium'],
  };

  const [prefs, setPrefs] = useState<ReminderPreferences>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customDays, setCustomDays] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/user/reminders');
        if (res.ok) {
          const data = await res.json();
          if (data.preferences) setPrefs(data.preferences);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleTimingToggle = (days: number) => {
    setPrefs(p => ({
      ...p,
      timing_days: p.timing_days.includes(days)
        ? p.timing_days.filter(d => d !== days)
        : [...p.timing_days, days].sort((a, b) => b - a)
    }));
  };

  const handleAddCustom = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = parseInt(customDays);
      if (!isNaN(val) && val > 0 && val <= 365 && !prefs.timing_days.includes(val)) {
        setPrefs(p => ({ ...p, timing_days: [...p.timing_days, val].sort((a, b) => b - a) }));
        setCustomDays('');
      } else {
        toast.error('Enter a valid day number (1-365) not already selected');
      }
    }
  };

  const handleTypeToggle = (type: string) => {
    setPrefs(p => ({
      ...p,
      types: p.types.includes(type)
        ? p.types.filter(t => t !== type)
        : [...p.types, type]
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/user/reminders`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Server error ${res.status}`);
      toast.success('Reminder settings saved!');
      if (onSave) onSave();
    } catch (e: any) {
      toast.error(e.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" /></div>;

  return (
    <div className="bg-card transition-colors rounded-2xl border border-border overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${prefs.enabled ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-muted-foreground'}`}>
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Central Database Reminders</h3>
            <p className="text-sm text-muted-foreground">Configure global automated alerts for all policies</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground/90">{prefs.enabled ? 'Active' : 'Disabled'}</span>
          <Switch checked={prefs.enabled} onCheckedChange={(enabled) => setPrefs(p => ({ ...p, enabled }))} />
        </div>
      </div>

      <div className={`p-6 space-y-6 ${!prefs.enabled && 'opacity-50 pointer-events-none'}`}>
        
        {/* Delivery Method */}
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Delivery Method</p>
          <div className="flex gap-4">
            <button
              onClick={() => setPrefs(p => ({ ...p, email: !p.email }))}
              className={`flex-1 p-4 rounded-xl border flex items-center gap-3 transition-colors ${prefs.email ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'bg-card transition-colors border-border text-foreground/90 hover:border-indigo-200'}`}
            >
              <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${prefs.email ? 'bg-indigo-600 text-white' : 'bg-muted transition-colors text-muted-foreground'}`}>
                <Mail className="w-4 h-4" />
              </div>
              Email Notification
              {prefs.email && <CheckCircle className="w-4 h-4 ml-auto text-indigo-600" />}
            </button>
            <div className="flex-1 p-4 rounded-xl border border-border bg-muted transition-colors text-muted-foreground flex items-center gap-3 opacity-50 cursor-not-allowed">
              <div className="w-8 h-8 rounded-lg shrink-0 bg-slate-200 flex items-center justify-center">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              SMS (Coming Soon)
            </div>
          </div>
        </div>

        {/* Reminder Types */}
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Notification Types</p>
          <div className="flex gap-3">
            {['renewal', 'premium'].map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer border rounded-full px-4 py-2 hover:bg-muted transition-colors transition-colors border-border">
                <input 
                  type="checkbox" 
                  checked={prefs.types.includes(t)}
                  onChange={() => handleTypeToggle(t)}
                  className="rounded text-indigo-600 accent-indigo-600 cursor-pointer w-4 h-4"
                />
                <span className="text-sm font-semibold text-foreground capitalize">{t === 'renewal' ? 'Policy Renewal' : 'Premium Payment'}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Timings */}
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center justify-between">
            Schedule Timing
            <span className="normal-case tracking-normal font-normal text-muted-foreground">Days before expiry</span>
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            {[30, 15, 7, 3, 1].map(days => (
              <button
                key={days}
                onClick={() => handleTimingToggle(days)}
                className={`px-4 py-2 rounded-xl border text-sm font-bold transition-colors ${
                  prefs.timing_days.includes(days) 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : 'bg-card transition-colors border-border text-muted-foreground hover:border-border/80'
                }`}
              >
                {prefs.timing_days.includes(days) && <span className="inline-block mr-1.5">•</span>}
                {days} {days === 1 ? 'day' : 'days'}
              </button>
            ))}
            <div className="relative">
              <input 
                type="text"
                placeholder="Custom (press enter)"
                value={customDays}
                onChange={e => setCustomDays(e.target.value.replace(/\D/g, ''))}
                onKeyDown={handleAddCustom}
                className="px-4 py-2 w-44 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />
            </div>
          </div>
        </div>

      </div>
      <div className="px-6 py-4 border-t border-border bg-muted transition-colors flex justify-end">
        <Button onClick={saveSettings} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 font-bold px-6">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Reminder Config
        </Button>
      </div>
    </div>
  );
}
