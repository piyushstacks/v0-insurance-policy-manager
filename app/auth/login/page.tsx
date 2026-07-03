'use client';

import { useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Mail, ArrowRight, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { Suspense } from 'react';
import { emailRegex } from '@/lib/schemas';

function LoginContent() {
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/app';

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Cooldown timer ──────────────────────────────────────────────
  function startCooldown(seconds: number) {
    setCooldown(seconds);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  // ── Step 1: Send OTP ───────────────────────────────────────────
  async function handleSendOTP(e?: React.FormEvent) {
    e?.preventDefault();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) { setError('Enter a valid email address with a domain (e.g. .com, .in).'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'login' }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.cooldown) startCooldown(data.cooldown);
        setError(data.error || 'Failed to send OTP.');
        return;
      }
      setStep('otp');
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Verify OTP ─────────────────────────────────────────
  async function handleVerifyOTP(e?: React.FormEvent, overrideCode?: string) {
    e?.preventDefault();
    const code = overrideCode ?? otp.join('');
    if (code.length !== 6) {
      setOtpError('Please enter the full 6-digit code.');
      return;
    }
    setOtpError('');
    setError('');
    setLoading(true);
    try {
      // Step 1: Verify the OTP code
      const verifyRes = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code, purpose: 'login' }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) { setError(verifyData.error || 'Invalid code.'); return; }

      // Step 2: Generate a real Supabase session (server-side, admin API)
      const sessionRes = await fetch('/api/auth/otp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!sessionRes.ok) {
        const sData = await sessionRes.json();
        setError(sData.error || 'Failed to create session. Please try again.');
        return;
      }
      const { accessToken, refreshToken } = await sessionRes.json();

      // Step 3: Set cookies SERVER-SIDE via createServerClient so middleware
      // can read them immediately on the next request (client-side setSession
      // writes to localStorage/browser memory, not the HTTP cookie middleware reads)
      const cookieRes = await fetch('/api/auth/otp/cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, refreshToken }),
      });
      if (!cookieRes.ok) {
        const cData = await cookieRes.json();
        setError(cData.error || 'Session setup failed. Please try again.');
        return;
      }

      // Step 4: Hard redirect — browser now has the auth cookie set by the server
      window.location.href = nextUrl;
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }


  // ── OTP input handler ──────────────────────────────────────────
  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (next.join('').length === 6) {
      setOtpError('');
    }
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (next.join('').length === 6) {
      // Auto-submit — pass code directly to avoid stale closure on otp state
      const fullCode = next.join('');
      setTimeout(() => handleVerifyOTP(undefined, fullCode), 100);
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(''));
      setOtpError('');
      otpRefs.current[5]?.focus();
      setTimeout(() => handleVerifyOTP(undefined, text), 100);
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
          <h1 className="text-2xl font-black text-slate-900">PolicyVault</h1>
          <p className="text-slate-500 text-sm mt-1">AI-Powered Insurance Management</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-[28px] p-8 shadow-xl shadow-slate-100">

          {step === 'email' && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">Sign in</h2>
                <p className="text-slate-500 text-sm mt-1">We'll send a 6-digit code to your email.</p>
              </div>

              <form onSubmit={handleSendOTP} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl">{error}</div>
                )}
                <div>
                  <label htmlFor="email" className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="pl-10 h-12 rounded-2xl border-slate-200"
                      autoFocus
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading || !emailRegex.test(email)}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold gap-2 shadow-lg shadow-blue-200"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Mail className="w-4 h-4" /> Send Code</>}
                </Button>
              </form>
            </>
          )}

          {step === 'otp' && (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-xl font-bold text-slate-900">Check your email</h2>
                </div>
                <p className="text-slate-500 text-sm">
                  Code sent to <strong className="text-slate-700">{email}</strong>. Valid 5 minutes.
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-6">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl">{error}</div>
                )}

                {/* OTP Boxes */}
                <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-2xl font-black border-2 rounded-2xl outline-none transition-all
                        ${
                          otpError
                            ? 'border-red-400 bg-red-50 text-red-700'
                            : digit
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-50 text-slate-900'
                        }
                        focus:border-blue-500 focus:bg-blue-50`}
                    />
                  ))}
                </div>
                {otpError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl -mt-2 font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {otpError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold gap-2 shadow-lg shadow-blue-200"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Verify & Sign In</>}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setError(''); setOtp(['','','','','','']); }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ← Change email
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendOTP()}
                    disabled={cooldown > 0 || loading}
                    className="text-blue-600 hover:text-blue-700 disabled:text-slate-400 flex items-center gap-1 font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="text-blue-600 font-semibold hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
