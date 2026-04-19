'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users, CheckCircle, AlertCircle, Loader2, ArrowRight,
  Shield, Mail, Lock, Eye, EyeOff, RefreshCw, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { emailRegex } from '@/lib/schemas';
import { Suspense } from 'react';

type State =
  | 'loading'       // validating token
  | 'valid'         // token OK, user not logged in → show auth form
  | 'auth_login'    // entering email for OTP login
  | 'auth_otp'      // OTP verification
  | 'auth_signup'   // new user signup form
  | 'auth_verify'   // OTP for signup email verification
  | 'joining'       // calling POST /api/team/join
  | 'success'
  | 'invalid'
  | 'error';

function JoinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [state, setState] = useState<State>('loading');
  const [teamName, setTeamName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [formError, setFormError] = useState('');

  // ── Cooldown ────────────────────────────────────────────────────
  function startCooldown(s: number) {
    setCooldown(s);
    const iv = setInterval(() => setCooldown(p => { if (p <= 1) { clearInterval(iv); return 0; } return p - 1; }), 1000);
  }

  // ── Validate token on load ──────────────────────────────────────
  useEffect(() => {
    if (!token) { setState('invalid'); setErrorMsg('No invitation token found.'); return; }
    validateToken();
  }, [token]);

  async function validateToken() {
    try {
      const res = await fetch(`/api/team/join?token=${token}`);
      const data = await res.json();
      if (!res.ok) { setState('invalid'); setErrorMsg(data.error || 'Invalid invitation.'); return; }
      setTeamName(data.teamName);
      setExpiresAt(data.expiresAt);

      // Check if already logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Already logged in — accept immediately
        acceptInvite();
      } else {
        setState('valid');
      }
    } catch { setState('invalid'); setErrorMsg('Failed to validate invitation.'); }
  }

  // ── Accept invitation (user must be logged in) ──────────────────
  async function acceptInvite() {
    setState('joining');
    try {
      const res = await fetch('/api/team/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to accept invitation.');
        setState('error');
        return;
      }
      setTeamName(data.teamName);
      setState('success');
      setTimeout(() => router.push('/app/settings/team'), 2000);
    } catch { setErrorMsg('Something went wrong.'); setState('error'); }
  }

  // ── Send OTP ────────────────────────────────────────────────────
  async function sendOTP(purpose: 'login' | 'signup') {
    setFormError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.cooldown) startCooldown(data.cooldown);
        setFormError(data.error || 'Failed to send code.');
        return false;
      }
      return true;
    } catch {
      setFormError('Network error.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  // ── Handle Login: send OTP ──────────────────────────────────────
  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailRegex.test(email)) { setFormError('Enter a valid email with a domain (e.g. .com, .in)'); return; }
    const ok = await sendOTP('login');
    if (ok) {
      setOtp(['', '', '', '', '', '']);
      setState('auth_otp');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }

  // ── Handle Signup: create account + send OTP ────────────────────
  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!fullName.trim()) { setFormError('Full name is required.'); return; }
    if (!emailRegex.test(email)) { setFormError('Enter a valid email with a domain (e.g. .com, .in)'); return; }
    if (password.length < 8) { setFormError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPwd) { setFormError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (signUpError) { setFormError(signUpError.message); return; }

      const ok = await sendOTP('signup');
      if (ok) {
        setOtp(['', '', '', '', '', '']);
        setState('auth_verify');
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch { setFormError('Signup failed. Please try again.'); }
    finally { setLoading(false); }
  }

  // ── Verify OTP (both login + signup) ───────────────────────────
  async function handleVerifyOTP(e?: React.FormEvent) {
    e?.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { setFormError('Enter the full 6-digit code.'); return; }
    setFormError('');
    setLoading(true);

    const purpose = state === 'auth_verify' ? 'signup' : 'login';
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code, purpose }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Invalid code.'); return; }

      // Sign in
      if (purpose === 'signup') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setFormError(error.message); return; }
      } else {
        // Login via session endpoint
        const sessionRes = await fetch('/api/auth/otp/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!sessionRes.ok) {
          const sData = await sessionRes.json();
          setFormError(sData.error || 'Failed to create session.');
          return;
        }
        const { accessToken, refreshToken } = await sessionRes.json();
        const { error: setErr } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (setErr) { setFormError(setErr.message); return; }
      }

      // Now accept the invitation
      acceptInvite();
    } catch { setFormError('Verification failed. Please try again.'); }
    finally { setLoading(false); }
  }

  // ── OTP input helpers ───────────────────────────────────────────
  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp]; next[index] = value.slice(-1); setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (next.join('').length === 6) setTimeout(() => handleVerifyOTP(), 100);
  }
  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  }
  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) { setOtp(text.split('')); otpRefs.current[5]?.focus(); setTimeout(() => handleVerifyOTP(), 100); }
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-xl font-bold text-white">PolicyVault</span>
          </div>
          <p className="text-slate-400 text-sm">AI-Powered Insurance Management</p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8 shadow-2xl">

          {/* Loading */}
          {state === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 animate-spin text-blue-400 mx-auto mb-4" />
              <p className="text-slate-300">Validating invitation...</p>
            </div>
          )}

          {/* Valid — show auth choice */}
          {state === 'valid' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">You're Invited!</h1>
                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-400/20 rounded-2xl">
                  <p className="text-blue-300 font-semibold">{teamName}</p>
                  <p className="text-slate-400 text-xs mt-0.5">Invited as a Member</p>
                </div>
                {expiresAt && <p className="text-slate-500 text-xs mt-2">Expires {new Date(expiresAt).toLocaleString()}</p>}
              </div>
              <p className="text-slate-400 text-sm text-center">Sign in or create an account to accept.</p>
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => { setAuthMode('login'); setState('auth_login'); setFormError(''); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-11 font-semibold">
                  Sign In
                </Button>
                <Button onClick={() => { setAuthMode('signup'); setState('auth_signup'); setFormError(''); }}
                  variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-2xl h-11 font-semibold">
                  Sign Up
                </Button>
              </div>
            </div>
          )}

          {/* Login: email → OTP */}
          {state === 'auth_login' && (
            <div className="space-y-5">
              <div>
                <button onClick={() => setState('valid')} className="text-slate-400 hover:text-white text-sm mb-4 flex items-center gap-1">← Back</button>
                <h2 className="text-xl font-bold text-white">Sign in to accept</h2>
                <p className="text-slate-400 text-sm mt-1">We'll send a 6-digit code to your email.</p>
              </div>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {formError && <div className="p-3 bg-red-500/10 border border-red-400/30 text-red-300 text-sm rounded-2xl">{formError}</div>}
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input type="email" placeholder="you@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} disabled={loading}
                    className="pl-10 h-12 rounded-2xl bg-white/5 border-white/20 text-white placeholder:text-slate-500" />
                </div>
                <Button type="submit" disabled={loading || !emailRegex.test(email)}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4" /> Send Code</>}
                </Button>
              </form>
              <p className="text-center text-slate-500 text-sm">
                No account?{' '}
                <button onClick={() => { setState('auth_signup'); setFormError(''); }} className="text-blue-400 hover:text-blue-300 font-medium">Sign up instead</button>
              </p>
            </div>
          )}

          {/* Signup form */}
          {state === 'auth_signup' && (
            <div className="space-y-4">
              <div>
                <button onClick={() => setState('valid')} className="text-slate-400 hover:text-white text-sm mb-4 flex items-center gap-1">← Back</button>
                <h2 className="text-xl font-bold text-white">Create account</h2>
                <p className="text-slate-400 text-sm mt-1">Verify your email to join the team.</p>
              </div>
              <form onSubmit={handleSignupSubmit} className="space-y-3">
                {formError && <div className="p-3 bg-red-500/10 border border-red-400/30 text-red-300 text-sm rounded-2xl">{formError}</div>}
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input type="text" placeholder="Full Name" value={fullName}
                    onChange={e => setFullName(e.target.value)} disabled={loading}
                    className="pl-10 h-11 rounded-2xl bg-white/5 border-white/20 text-white placeholder:text-slate-500" />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input type="email" placeholder="you@example.com" value={email}
                    onChange={e => setEmail(e.target.value)} disabled={loading}
                    className="pl-10 h-11 rounded-2xl bg-white/5 border-white/20 text-white placeholder:text-slate-500" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters"
                    value={password} onChange={e => setPassword(e.target.value)} disabled={loading}
                    className="pl-10 pr-10 h-11 rounded-2xl bg-white/5 border-white/20 text-white placeholder:text-slate-500" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input type="password" placeholder="Confirm password"
                    value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} disabled={loading}
                    className="pl-10 h-11 rounded-2xl bg-white/5 border-white/20 text-white placeholder:text-slate-500" />
                </div>
                <Button type="submit" disabled={loading || !emailRegex.test(email)}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold gap-2 mt-1">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Continue</>}
                </Button>
              </form>
              <p className="text-center text-slate-500 text-sm">
                Have an account?{' '}
                <button onClick={() => { setState('auth_login'); setFormError(''); }} className="text-blue-400 hover:text-blue-300 font-medium">Sign in</button>
              </p>
            </div>
          )}

          {/* OTP verification (login or signup) */}
          {(state === 'auth_otp' || state === 'auth_verify') && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-xl font-bold text-white">Check your email</h2>
                </div>
                <p className="text-slate-400 text-sm">
                  Code sent to <strong className="text-white">{email}</strong>. Valid 5 minutes.
                </p>
              </div>
              <form onSubmit={handleVerifyOTP} className="space-y-6">
                {formError && <div className="p-3 bg-red-500/10 border border-red-400/30 text-red-300 text-sm rounded-2xl">{formError}</div>}
                <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input key={i} ref={el => { otpRefs.current[i] = el; }}
                      type="text" inputMode="numeric" maxLength={1} value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-2xl font-black border-2 rounded-2xl outline-none transition-all bg-white/5
                        ${digit ? 'border-blue-400 bg-blue-500/10 text-blue-300' : 'border-white/20 text-white'}
                        focus:border-blue-400 focus:bg-blue-500/10`}
                    />
                  ))}
                </div>
                <Button type="submit" disabled={loading || otp.join('').length !== 6}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold gap-2">
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Users className="w-4 h-4" /> Verify & Join Team</>}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button"
                    onClick={() => setState(state === 'auth_verify' ? 'auth_signup' : 'auth_login')}
                    className="text-slate-500 hover:text-white">← Back</button>
                  <button type="button"
                    onClick={() => sendOTP(state === 'auth_verify' ? 'signup' : 'login')}
                    disabled={cooldown > 0 || loading}
                    className="text-blue-400 hover:text-blue-300 disabled:text-slate-600 flex items-center gap-1 font-medium">
                    <RefreshCw className="w-3.5 h-3.5" />
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Joining */}
          {state === 'joining' && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 animate-spin text-blue-400 mx-auto mb-4" />
              <p className="text-slate-300">Joining the team...</p>
            </div>
          )}

          {/* Success */}
          {state === 'success' && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
              <h2 className="text-xl font-bold text-white">Welcome to {teamName}!</h2>
              <p className="text-slate-400 text-sm">Redirecting to your team dashboard...</p>
              <Loader2 className="w-5 h-5 animate-spin text-blue-400 mx-auto" />
            </div>
          )}

          {/* Invalid / Error */}
          {(state === 'invalid' || state === 'error') && (
            <div className="text-center space-y-4 py-4">
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
              <h2 className="text-xl font-bold text-white">
                {state === 'invalid' ? 'Invalid Invitation' : 'Something went wrong'}
              </h2>
              <p className="text-slate-400 text-sm">{errorMsg}</p>
              <Button onClick={() => router.push('/auth/login')}
                variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-2xl">
                Go to Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
      </div>
    }>
      <JoinPageContent />
    </Suspense>
  );
}
