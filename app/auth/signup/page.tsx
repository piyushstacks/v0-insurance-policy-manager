'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Shield, ArrowRight, Loader2, Sparkles, Clock, Activity, Users, Bell } from 'lucide-react';
import { Suspense } from 'react';
import { WavyBackground } from '@/components/ui/wavy-background';

function SignupContent() {
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

          {/* ── Registration Disabled ── */}
          <div className="animate-fade-in text-center py-6">
            <h3 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-3">Registration Closed</h3>
            <p className="text-slate-400 text-sm md:text-base font-medium mb-8 leading-relaxed">
              New account registrations are currently disabled for outside access. 
              Please contact your administrator if you need an account.
            </p>
            <Link href="/auth/login" className="block w-full">
              <Button className="w-full h-[48px] bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold text-sm md:text-base transition-all border border-white/10">
                Return to Login
              </Button>
            </Link>
          </div>

        </div>
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
