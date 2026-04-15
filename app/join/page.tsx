'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, CheckCircle, AlertCircle, Loader2, ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

function JoinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [state, setState] = useState<'loading' | 'valid' | 'invalid' | 'joining' | 'success' | 'error'>('loading');
  const [teamName, setTeamName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setState('invalid'); setErrorMsg('No invitation token found.'); return; }
    validateToken();
  }, [token]);

  async function validateToken() {
    try {
      const res = await fetch(`/api/team/join?token=${token}`);
      const data = await res.json();
      if (!res.ok) { setState('invalid'); setErrorMsg(data.error || 'Invalid invitation.'); return; }
      setTeamName(data.teamName); setExpiresAt(data.expiresAt); setState('valid');
    } catch { setState('invalid'); setErrorMsg('Failed to validate invitation.'); }
  }

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
        if (res.status === 401) { router.push(`/auth/login?next=/join?token=${token}`); return; }
        setErrorMsg(data.error || 'Failed to accept invitation.'); setState('error'); return;
      }
      setTeamName(data.teamName); setState('success');
      setTimeout(() => router.push('/app/settings/team'), 2000);
    } catch { setErrorMsg('Something went wrong.'); setState('error'); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-xl font-bold text-white">PolicyVault</span>
          </div>
          <p className="text-slate-400 text-sm">AI-Powered Insurance Management</p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8 shadow-2xl">
          {state === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 animate-spin text-blue-400 mx-auto mb-4" />
              <p className="text-slate-300">Validating invitation...</p>
            </div>
          )}

          {state === 'valid' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">You're Invited!</h1>
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-400/20 rounded-2xl">
                  <p className="text-blue-300 font-semibold text-lg">{teamName}</p>
                  <p className="text-slate-400 text-xs mt-1">Invited as a Member</p>
                </div>
                {expiresAt && <p className="text-slate-500 text-xs mt-3">Expires {new Date(expiresAt).toLocaleString()}</p>}
              </div>
              <Button
                onClick={acceptInvite}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-2xl font-semibold gap-2"
              >
                Accept Invitation <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {state === 'joining' && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 animate-spin text-blue-400 mx-auto mb-4" />
              <p className="text-slate-300">Joining team...</p>
            </div>
          )}

          {state === 'success' && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
              <h2 className="text-xl font-bold text-white">Welcome to {teamName}!</h2>
              <p className="text-slate-400 text-sm">Redirecting to your team...</p>
            </div>
          )}

          {(state === 'invalid' || state === 'error') && (
            <div className="text-center space-y-4 py-4">
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
              <h2 className="text-xl font-bold text-white">Invalid Invitation</h2>
              <p className="text-slate-400 text-sm">{errorMsg}</p>
              <Button onClick={() => router.push('/auth/login')} variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-2xl">
                Go to Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { Suspense } from 'react';
export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
      </div>
    }>
      <JoinPageContent />
    </Suspense>
  );
}
