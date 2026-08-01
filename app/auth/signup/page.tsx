'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Mail, User, Lock, Eye, EyeOff, ArrowRight, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { Suspense } from 'react';

type Step = 'form' | 'otp' | 'done';

function SignupContent() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('form');
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Cooldown timer ──────────────────────────────────────────────
  function startCooldown(seconds: number) {
    setCooldown(seconds);
    const iv = setInterval(() => {
      setCooldown(p => { if (p <= 1) { clearInterval(iv); return 0; } return p - 1; });
    }, 1000);
  }

  // ── Step 1: Signup + Send OTP ───────────────────────────────────
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!formData.fullName.trim()) { setError('Full name is required.'); return; }
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email)) { 
      setError('Enter a valid email address with a domain (e.g. .com, .in).'); 
      return; 
    }

    if (formData.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      // Create account in Supabase
      const { error: signUpError, data } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.fullName },
          emailRedirectTo: undefined, // We handle verification ourselves
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // Send our custom OTP for email verification
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, purpose: 'signup' }),
      });
      const result = await res.json();

      if (!res.ok) {
        if (result.cooldown) startCooldown(result.cooldown);
        setError(result.error || 'Failed to send verification code.');
        return;
      }

      setStep('otp');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setError('Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Verify OTP ─────────────────────────────────────────
  async function handleVerifyOTP(e?: React.FormEvent) {
    e?.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { setError('Enter the full 6-digit code.'); return; }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, otp: code, purpose: 'signup' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid code.'); return; }

      // Sign in with the password they just set
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      setStep('done');
      setTimeout(() => { router.push('/app'); router.refresh(); }, 1500);
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function resendOTP() {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, purpose: 'signup' }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.cooldown) startCooldown(data.cooldown);
        setError(data.error || 'Failed to resend code.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }

  // ── OTP input ──────────────────────────────────────────────────
  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (next.join('').length === 6) setTimeout(() => handleVerifyOTP(), 100);
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(''));
      otpRefs.current[5]?.focus();
      setTimeout(() => handleVerifyOTP(), 100);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-foreground">PolicyVault</h1>
          <p className="text-muted-foreground text-sm mt-1">AI-Powered Insurance Management</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(['form', 'otp', 'done'] as Step[]).map((s, i) => (
            <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${
              step === s ? 'w-8 bg-blue-600' :
              (['form', 'otp', 'done'].indexOf(step) > i) ? 'w-4 bg-blue-300' : 'w-4 bg-slate-200'
            }`} />
          ))}
        </div>

        {/* Card */}
        <div className="bg-card transition-colors border border-border rounded-[28px] p-8 shadow-xl shadow-slate-100">

          {/* ── Step 1: Form ── */}
          {step === 'form' && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Create account</h2>
                <p className="text-muted-foreground text-sm mt-1">We'll verify your email with a 6-digit code.</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl">{error}</div>}

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="text" placeholder="Piyush Bhagchandani" value={formData.fullName}
                      onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                      disabled={loading} className="pl-10 h-12 rounded-2xl border-border" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="you@example.com" value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      disabled={loading} className="pl-10 h-12 rounded-2xl border-border" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      disabled={loading} className="pl-10 pr-10 h-12 rounded-2xl border-border" />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/90">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="Repeat password"
                      value={formData.confirmPassword}
                      onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                      disabled={loading} className="pl-10 h-12 rounded-2xl border-border" />
                  </div>
                </div>

                <Button type="submit" disabled={loading}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold gap-2 shadow-lg shadow-blue-200">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Continue</>}
                </Button>
              </form>
            </>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-xl font-bold text-foreground">Verify your email</h2>
                </div>
                <p className="text-muted-foreground text-sm">
                  Code sent to <strong className="text-foreground">{formData.email}</strong>. Valid 5 minutes.
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-6">
                {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl">{error}</div>}

                <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input key={i} ref={el => { otpRefs.current[i] = el; }}
                      type="text" inputMode="numeric" maxLength={1} value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-2xl font-black border-2 rounded-2xl outline-none transition-all
                        ${digit ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border bg-muted transition-colors'}
                        focus:border-blue-500 focus:bg-blue-50`}
                    />
                  ))}
                </div>

                <Button type="submit" disabled={loading || otp.join('').length !== 6}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold gap-2 shadow-lg shadow-blue-200">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Verify & Create Account</>}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => { setStep('form'); setError(''); setOtp(['','','','','','']); }}
                    className="text-muted-foreground hover:text-foreground/90">← Back</button>
                  <button type="button" onClick={resendOTP} disabled={cooldown > 0 || loading}
                    className="text-blue-600 hover:text-blue-700 disabled:text-muted-foreground flex items-center gap-1 font-medium">
                    <RefreshCw className="w-3.5 h-3.5" />
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-20 h-20 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Account created!</h2>
              <p className="text-muted-foreground text-sm">Redirecting you to the dashboard...</p>
              <Loader2 className="w-5 h-5 animate-spin text-blue-500 mx-auto" />
            </div>
          )}
        </div>

        {step === 'form' && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
      <SignupContent />
    </Suspense>
  );
}
