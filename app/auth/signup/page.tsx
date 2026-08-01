'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Mail, User, Lock, Eye, EyeOff, ArrowRight, RefreshCw, Loader2, CheckCircle, Sparkles, Clock, Activity, Users, Bell } from 'lucide-react';
import { Suspense } from 'react';
import { WavyBackground } from '@/components/ui/wavy-background';

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
    <WavyBackground 
      containerClassName="h-[100dvh] flex items-center justify-center overflow-hidden dark bg-[#050505]" 
      className="w-full h-full max-w-7xl mx-auto flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-4 relative z-10"
    >
      
      {/* Hero Section */}
      <div className="text-center w-full animate-fade-in hidden sm:flex flex-col items-center mt-2">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight drop-shadow-xl leading-tight">
          Join <span className="text-blue-400">Apex OS</span>.
        </h1>
        <p className="text-slate-300 mt-2 text-sm md:text-base font-medium max-w-[600px] mx-auto opacity-90 leading-relaxed">
          The next-generation intelligence platform for wealth & insurance management.
        </p>
      </div>

      <div className="w-full max-w-[460px] z-20 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
        {/* Glass Card */}
        <div className="bg-[#0a0a0c]/80 backdrop-blur-2xl border border-white/[0.08] rounded-[32px] p-6 md:p-8 relative overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]">
          {/* Subtle top glare effect */}
          <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

          {/* Logo inside card */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 shadow-inner">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide">PolicyVault</h2>
          </div>

          {/* ── Step 1: Form ── */}
          {step === 'form' && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Create your account</h3>
                <p className="text-slate-400 text-sm mt-1 font-medium">Get started with a secure vault.</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-3 md:space-y-4">
                {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl text-center backdrop-blur-md">{error}</div>}
                
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                  <Input
                    type="text"
                    placeholder="Full Name"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="pl-11 h-[48px] rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-400/50 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm md:text-base shadow-inner"
                    required
                  />
                </div>

                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                  <Input
                    type="email"
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-11 h-[48px] rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-400/50 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm md:text-base shadow-inner"
                    required
                  />
                </div>

                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                  <Input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-11 pr-11 h-[48px] rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-400/50 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm md:text-base shadow-inner"
                    required
                    minLength={8}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                  <Input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="pl-11 h-[48px] rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-400/50 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm md:text-base shadow-inner"
                    required
                    minLength={8}
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full h-[48px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm md:text-base gap-2 shadow-[0_0_20px_rgba(37,99,235,0.2)] transition-all border border-white/10 mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Create Account</>}
                </Button>
              </form>
            </div>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <div className="flex justify-center mb-3">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 shadow-inner">
                    <CheckCircle className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight">Verify email</h3>
                <p className="text-slate-400 text-sm mt-1 font-medium">Code sent to <span className="text-white">{formData.email}</span></p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-5">
                {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl text-center backdrop-blur-md">{error}</div>}
                
                <div className="flex justify-between gap-2 md:gap-3">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => { otpRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(idx, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      className="w-[40px] h-[48px] sm:w-[48px] sm:h-[56px] text-center text-xl md:text-2xl font-black bg-white/5 border border-white/10 text-white rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400/80 transition-all placeholder:text-slate-600 shadow-inner"
                      placeholder="-"
                    />
                  ))}
                </div>

                <Button type="submit" disabled={loading} className="w-full h-[48px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm md:text-base gap-2 shadow-[0_0_20px_rgba(37,99,235,0.2)] transition-all border border-white/10 mt-1 disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Verify & Continue</>}
                </Button>

                <div className="flex items-center justify-between text-xs md:text-sm pt-2 font-medium">
                  <button type="button" onClick={() => { setStep('form'); setError(''); setOtp(['','','','','','']); }} className="text-slate-400 hover:text-white transition-colors px-2 py-1 -ml-2 rounded-lg hover:bg-white/5">
                    ← Back
                  </button>
                  <button type="button" onClick={resendOTP} disabled={cooldown > 0 || loading} className="text-blue-400 hover:text-blue-300 disabled:text-slate-500 transition-colors flex items-center gap-1.5 px-2 py-1 -mr-2 rounded-lg hover:bg-blue-500/10 disabled:hover:bg-transparent">
                    <RefreshCw className={`w-3 h-3 md:w-3.5 md:h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && (
            <div className="text-center py-6 space-y-4 animate-fade-in">
              <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white">Account created!</h2>
              <p className="text-slate-400 text-sm">Redirecting you to the dashboard...</p>
              <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto mt-4" />
            </div>
          )}
        </div>

        {step === 'form' && (
          <p className="text-center text-sm md:text-base text-slate-400 mt-6 font-medium">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 transition-colors py-1 px-2 rounded-lg hover:bg-blue-500/10">Sign in</Link>
          </p>
        )}
      </div>

      {/* Infinite Marquee Features List - Hidden on small screens */}
      <div 
        className="w-full max-w-[100vw] overflow-hidden mt-4 relative mask-edges opacity-0 animate-fade-in-up hidden md:block" 
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
              className="flex items-center gap-2 bg-[#0a0a0c]/60 border border-white/5 px-4 py-2 rounded-full text-sm font-medium text-slate-300 backdrop-blur-md whitespace-nowrap cursor-default shadow-lg"
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

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
      <SignupContent />
    </Suspense>
  );
}
