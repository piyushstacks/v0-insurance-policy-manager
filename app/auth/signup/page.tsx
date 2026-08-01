'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Mail, User, Lock, Eye, EyeOff, ArrowRight, RefreshCw, Loader2, CheckCircle, Sparkles, Clock, Activity, Users, Bell } from 'lucide-react';
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
    <div className="min-h-screen mesh-bg flex flex-col items-center justify-center p-4 relative overflow-hidden dark">
      
      {/* Animated Greeting */}
      <div className="absolute top-8 md:top-16 text-center z-10 w-full animate-fade-in hidden sm:flex flex-col items-center">
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-2xl">
          Join <span className="text-blue-400">Apex OS</span>.
        </h1>
        <p className="text-slate-300 mt-3 text-sm md:text-base font-medium max-w-sm mx-auto mb-6">
          The next-generation intelligence platform for wealth & insurance management.
        </p>

        {/* Infinite Marquee Features List */}
        <div 
          className="w-full max-w-[100vw] overflow-hidden mt-4 relative mask-edges opacity-0 animate-fade-in-up" 
          style={{ animationDelay: '600ms', animationFillMode: 'forwards' }}
        >
          <div className="flex w-max gap-4 px-4 animate-marquee hover:animation-play-state-paused">
            {[
              { icon: Sparkles, text: 'AI Data Extraction' },
              { icon: Clock, text: 'Automated Renewals' },
              { icon: Activity, text: 'Gap Detection' },
              { icon: Users, text: 'Team Collaboration' },
              { icon: Bell, text: 'Smart Reminders' },
              // Duplicate for infinite scrolling effect
              { icon: Sparkles, text: 'AI Data Extraction' },
              { icon: Clock, text: 'Automated Renewals' },
              { icon: Activity, text: 'Gap Detection' },
              { icon: Users, text: 'Team Collaboration' },
              { icon: Bell, text: 'Smart Reminders' }
            ].map((feature, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2.5 rounded-full text-sm font-medium text-slate-300 backdrop-blur-md whitespace-nowrap hover:bg-white/10 transition-colors cursor-default"
              >
                <feature.icon className="w-4 h-4 text-blue-400" />
                {feature.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full max-w-md z-20 mt-12 sm:mt-24 animate-fade-in-up">
        {/* Glass Card */}
        <div className="glass-panel rounded-[32px] p-8 md:p-10 relative overflow-hidden">
          {/* Subtle top glare effect */}
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>

          {/* Logo inside card */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide">PolicyVault</h2>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {(['form', 'otp', 'done'] as Step[]).map((s, i) => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${
                step === s ? 'w-8 bg-blue-500' :
                (['form', 'otp', 'done'].indexOf(step) > i) ? 'w-4 bg-blue-400/50' : 'w-4 bg-white/10'
              }`} />
            ))}
          </div>

          {/* ── Step 1: Form ── */}
          {step === 'form' && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-white">Create account</h3>
                <p className="text-slate-400 text-sm mt-1">We'll verify your email with a 6-digit code.</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl text-center backdrop-blur-md">{error}</div>}

                <div>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                    <Input type="text" placeholder="Full Name" value={formData.fullName}
                      onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                      disabled={loading} className="pl-12 h-14 rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-400/50 transition-all text-base shadow-inner" />
                  </div>
                </div>

                <div>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                    <Input type="email" placeholder="Email Address" value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      disabled={loading} className="pl-12 h-14 rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-400/50 transition-all text-base shadow-inner" />
                  </div>
                </div>

                <div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                    <Input type={showPass ? 'text' : 'password'} placeholder="Password (Min 8)"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      disabled={loading} className="pl-12 pr-12 h-14 rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-400/50 transition-all text-base shadow-inner" />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                      {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                    <Input type="password" placeholder="Confirm Password"
                      value={formData.confirmPassword}
                      onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                      disabled={loading} className="pl-12 h-14 rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-400/50 transition-all text-base shadow-inner" />
                  </div>
                </div>

                <Button type="submit" disabled={loading}
                  className="w-full h-14 mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-bold gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all border border-white/10">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-5 h-5" /> Request Access</>}
                </Button>
              </form>
            </div>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <div className="animate-fade-in">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white">Verify your email</h3>
                <p className="text-slate-400 text-sm mt-2">
                  Code sent to <span className="text-white font-medium">{formData.email}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-6">
                {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl text-center backdrop-blur-md">{error}</div>}

                <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input key={i} ref={el => { otpRefs.current[i] = el; }}
                      type="text" inputMode="numeric" maxLength={1} value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-black border rounded-2xl outline-none transition-all shadow-inner
                        ${digit ? 'border-blue-400/50 bg-blue-500/20 text-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-white/10 bg-white/5 text-white'}
                        focus:border-blue-400/80 focus:bg-white/10`}
                    />
                  ))}
                </div>

                <Button type="submit" disabled={loading || otp.join('').length !== 6}
                  className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-bold gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all border border-white/10">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Verify & Create Account</>}
                </Button>

                <div className="flex items-center justify-between text-sm pt-2">
                  <button type="button" onClick={() => { setStep('form'); setError(''); setOtp(['','','','','','']); }}
                    className="text-slate-400 hover:text-white transition-colors">← Back</button>
                  <button type="button" onClick={resendOTP} disabled={cooldown > 0 || loading}
                    className="text-blue-400 hover:text-blue-300 disabled:text-slate-500 transition-colors flex items-center gap-1 font-medium">
                    <RefreshCw className="w-3.5 h-3.5" />
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && (
            <div className="text-center py-8 space-y-4 animate-fade-in">
              <div className="w-24 h-24 bg-emerald-500/20 border-2 border-emerald-500/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <CheckCircle className="w-12 h-12 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Account created!</h2>
              <p className="text-slate-400 text-sm">Redirecting you to the dashboard...</p>
              <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto mt-4" />
            </div>
          )}
        </div>

        {step === 'form' && (
          <p className="text-center text-sm text-slate-400 mt-8 font-medium">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 transition-colors">Sign in</Link>
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
