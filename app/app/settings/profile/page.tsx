'use client';

import { useState, useEffect } from 'react';
import {
  User, Mail, Save, Loader2, CheckCircle, RefreshCw,
  Shield, Crown, AlertCircle, KeyRound, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  team_id: string | null;
}

export default function ProfileSectionPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [emailChanged, setEmailChanged] = useState(false);

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(d => {
        setProfile(d);
        setName(d.full_name || '');
        setNewEmail(d.email || '');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  async function sendOTP() {
    setOtpSending(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, purpose: 'email-change' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to send OTP');
        if (data.cooldown) setOtpCooldown(data.cooldown);
        return;
      }
      setOtpSent(true);
      setOtpCooldown(30);
      toast.success(`Verification code sent to ${newEmail}`);
    } catch {
      toast.error('Failed to send OTP');
    } finally {
      setOtpSending(false);
    }
  }

  async function saveName() {
    if (!name.trim() || name.trim() === profile?.full_name) return;
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(p => p ? { ...p, full_name: name.trim() } : p);
      toast.success('Name updated!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveEmail() {
    if (!otp || otp.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_email: newEmail, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(p => p ? { ...p, email: newEmail } : p);
      setEmailChanged(true);
      setOtpSent(false);
      setOtp('');
      toast.success('Email updated successfully!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const emailIsChanged = newEmail !== profile?.email && newEmail.includes('@');

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Role badge */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl">
        {profile?.role === 'ADMIN'
          ? <Crown className="w-5 h-5 text-amber-600 shrink-0" />
          : <Shield className="w-5 h-5 text-blue-600 shrink-0" />
        }
        <div>
          <p className="text-sm font-bold text-slate-900">{profile?.role} Account</p>
          <p className="text-xs text-slate-500">Member since {new Date(profile?.id ? new Date().toISOString() : '').toLocaleDateString()}</p>
        </div>
      </div>

      {/* Name */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-600" /> Display Name
        </h3>
        <div className="flex gap-3">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            className="rounded-xl h-11"
          />
          <Button
            onClick={saveName}
            disabled={saving || !name.trim() || name.trim() === profile?.full_name}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 gap-2 shrink-0"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </div>
      </div>

      {/* Email */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-600" /> Email Address
          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-1">OTP Verified</span>
        </h3>
        <Input
          value={newEmail}
          onChange={e => { setNewEmail(e.target.value); setOtpSent(false); setOtp(''); }}
          placeholder="your@email.com"
          type="email"
          className="rounded-xl h-11"
        />

        {emailIsChanged && !otpSent && (
          <Button
            onClick={sendOTP}
            disabled={otpSending || otpCooldown > 0}
            variant="outline"
            className="gap-2 rounded-xl border-blue-300 text-blue-600 hover:bg-blue-50"
          >
            {otpSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Send Verification Code'}
          </Button>
        )}

        {otpSent && (
          <div className="space-y-3">
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
              ✅ Code sent to <strong>{newEmail}</strong>. Check your inbox.
            </p>
            <div className="flex gap-3">
              <Input
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className="rounded-xl h-11 text-center text-lg font-bold tracking-widest"
                maxLength={6}
              />
              <Button
                onClick={saveEmail}
                disabled={saving || otp.length !== 6}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 gap-2 shrink-0"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Verify & Save
              </Button>
            </div>
            <button
              onClick={sendOTP}
              disabled={otpCooldown > 0 || otpSending}
              className="text-xs text-blue-500 hover:underline disabled:opacity-40"
            >
              {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend code'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
