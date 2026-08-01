'use client';

import { useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Mail, ArrowRight, RefreshCw, Loader2, CheckCircle, Sparkles, Clock, Activity, Users, Bell } from 'lucide-react';
import { Suspense } from 'react';
import { emailRegex } from '@/lib/schemas';
import { WavyBackground } from '@/components/ui/wavy-background';

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
    <WavyBackground 
      containerClassName="min-h-screen flex items-center justify-center overflow-hidden dark bg-[#050505]" 
      className="w-full max-w-7xl mx-auto flex flex-col items-center justify-center gap-10 md:gap-14 px-6 py-12 relative z-10"
    >
      
      {/* Hero Section */}
      <div className="text-center w-full animate-fade-in flex flex-col items-center mt-8">
        <h1 className="text-4xl md:text-5xl lg:text-[56px] font-extrabold text-white tracking-tight drop-shadow-xl leading-tight">
          Welcome to <span className="text-blue-400">Apex OS</span>.
        </h1>
        <p className="text-slate-300 mt-5 text-base md:text-lg font-medium max-w-[600px] mx-auto opacity-90 leading-relaxed">
          The next-generation intelligence platform for wealth & insurance management.
        </p>
      </div>

      <div className="w-full max-w-[460px] z-20 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
        {/* Glass Card */}
        <div className="bg-[#0a0a0c]/80 backdrop-blur-2xl border border-white/[0.08] rounded-[32px] p-8 md:p-10 relative overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]">
          {/* Subtle top glare effect */}
          <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

          {/* Logo inside card */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-inner">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-wide">PolicyVault</h2>
          </div>

          {step === 'email' && (
            <div className="animate-fade-in">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-semibold text-white tracking-tight">Sign in to your vault</h3>
                <p className="text-slate-400 text-sm md:text-base mt-2 font-medium">Enter your email to receive a secure access code.</p>
              </div>

              <form onSubmit={handleSendOTP} className="space-y-5">
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl text-center backdrop-blur-md">{error}</div>
                )}
                <div>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="pl-12 h-[52px] rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-400/50 focus:ring-4 focus:ring-blue-500/10 transition-all text-base shadow-inner"
                      autoFocus
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading || !emailRegex.test(email)}
                  className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-semibold text-base gap-2 shadow-[0_0_20px_rgba(37,99,235,0.2)] transition-all border border-white/10 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Mail className="w-5 h-5" /> Send Access Code</>}
                </Button>
              </form>
            </div>
          )}

          {step === 'otp' && (
            <div className="animate-fade-in">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-inner">
                    <CheckCircle className="w-7 h-7 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-semibold text-white tracking-tight">Check your email</h3>
                <p className="text-slate-400 text-sm md:text-base mt-2 font-medium">
                  We sent a code to <span className="text-white">{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl text-center backdrop-blur-md">{error}</div>
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
                      className={`w-[46px] h-[56px] sm:w-[52px] sm:h-[60px] text-center text-2xl font-black border rounded-2xl outline-none transition-all shadow-inner
                        ${
                          otpError
                            ? 'border-red-500/50 bg-red-500/10 text-red-400'
                            : digit
                            ? 'border-blue-400/50 bg-blue-500/20 text-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                            : 'border-white/10 bg-white/5 text-white placeholder:text-slate-600'
                        }
                        focus:border-blue-400/80 focus:bg-white/10 focus:ring-4 focus:ring-blue-500/10`}
                    />
                  ))}
                </div>
                {otpError && (
                  <div className="text-red-400 text-sm font-medium text-center -mt-2">
                    {otpError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[52px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-semibold text-base gap-2 shadow-[0_0_20px_rgba(37,99,235,0.2)] transition-all border border-white/10 mt-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-5 h-5" /> Authenticate & Enter</>}
                </Button>

                <div className="flex items-center justify-between text-sm pt-4 font-medium">
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setError(''); setOtp(['','','','','','']); }}
                    className="text-slate-400 hover:text-white transition-colors px-2 py-1 -ml-2 rounded-lg hover:bg-white/5"
                  >
                    ← Change email
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendOTP()}
                    disabled={cooldown > 0 || loading}
                    className="text-blue-400 hover:text-blue-300 disabled:text-slate-500 transition-colors flex items-center gap-1.5 px-2 py-1 -mr-2 rounded-lg hover:bg-blue-500/10 disabled:hover:bg-transparent"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-sm md:text-base text-slate-400 mt-8 font-medium">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="text-blue-400 hover:text-blue-300 transition-colors py-1 px-2 rounded-lg hover:bg-blue-500/10">Request Access</Link>
        </p>
      </div>

      {/* Infinite Marquee Features List - Hidden on small screens */}
      <div 
        className="w-full max-w-[100vw] overflow-hidden mt-6 relative mask-edges opacity-0 animate-fade-in-up hidden md:block" 
        style={{ animationDelay: '600ms', animationFillMode: 'forwards' }}
      >
        <div className="flex w-max gap-4 px-4 animate-marquee hover:animation-play-state-paused">
          {[
            { icon: Sparkles, text: 'AI Data Extraction' },
            { icon: Clock, text: 'Automated Renewals' },
            { icon: Activity, text: 'Gap Detection' },
            { icon: Users, text: 'Team Collaboration' },
            { icon: Bell, text: 'Smart Reminders' },
            { icon: Sparkles, text: 'AI Data Extraction' },
            { icon: Clock, text: 'Automated Renewals' },
            { icon: Activity, text: 'Gap Detection' },
            { icon: Users, text: 'Team Collaboration' },
            { icon: Bell, text: 'Smart Reminders' }
          ].map((feature, idx) => (
            <div 
              key={idx} 
              className="flex items-center gap-2.5 bg-[#0a0a0c]/60 border border-white/5 px-5 py-2.5 rounded-full text-sm font-medium text-slate-300 backdrop-blur-md whitespace-nowrap cursor-default shadow-lg"
            >
              <feature.icon className="w-4 h-4 text-blue-400/80" />
              {feature.text}
            </div>
          ))}
        </div>
      </div>
    </WavyBackground>
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
