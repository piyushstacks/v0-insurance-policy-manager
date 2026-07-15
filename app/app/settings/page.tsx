'use client';

import React from 'react';
import Link from 'next/link';
import {
  Users, Bell, Shield, Cpu, User, Zap, Key, Database,
  CreditCard, Crown, ChevronRight, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SETTING_CARDS = [
  {
    id: 'team',
    title: 'Team Management',
    description: 'Create team, invite members, manage roles & permissions.',
    href: '/app/settings/team',
    icon: Users,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    border: 'border-blue-200',
    badge: <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">RBAC</span>,
    cta: 'Manage Team',
    ctaClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  {
    id: 'privacy',
    title: 'Privacy & Storage',
    description: 'Configure policy storage locations, link Google Drive, and manage client-side redaction.',
    href: '/app/settings/privacy',
    icon: Database,
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    border: 'border-indigo-200',
    cta: 'Storage Settings',
    ctaClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  {
    id: 'security',
    title: 'Security & Access',
    description: 'Change password, configure 2FA, manage active sessions.',
    href: '/app/settings/security',
    icon: Shield,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    border: 'border-emerald-200',
    cta: 'Security Settings',
    ctaClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  {
    id: 'ai',
    title: 'AI Extraction Engine',
    description: 'Multi-model consensus extraction with OCR cross-verification.',
    href: '/app/settings/ai',
    icon: Cpu,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    border: 'border-violet-200',
    badge: <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">● LIVE</span>,
    cta: 'Configure',
    ctaClass: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
  {
    id: 'profile',
    title: 'Profile Information',
    description: 'Edit your display name and email address with OTP verification.',
    href: '/app/settings/profile',
    icon: User,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    border: 'border-slate-200',
    cta: 'Edit Profile',
    ctaClass: 'bg-slate-800 hover:bg-slate-900 text-white',
  },
];

export default function SettingsPage() {
  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/50 pb-32">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-200">
            <Settings className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Settings</h1>
            <p className="font-medium text-slate-500">Global preferences and configuration.</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Settings Cards */}
          {SETTING_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.id} className={`bg-white rounded-[28px] p-6 border ${card.border} shadow-sm hover:shadow-md transition-shadow`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${card.iconBg} rounded-2xl flex items-center justify-center shrink-0`}>
                      <Icon className={`w-6 h-6 ${card.iconColor}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-slate-900">{card.title}</h2>
                        {card.badge}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{card.description}</p>
                    </div>
                  </div>
                  <Link href={card.href} className="shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                    <Button className={`${card.ctaClass} w-full sm:w-auto rounded-xl gap-2 text-sm h-10 px-4 whitespace-nowrap`}>
                      {card.cta}
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}

          {/* Billing Card */}
          <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 rounded-[28px] p-6 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-emerald-900/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-black text-lg leading-none mb-1">Standard Pro Plan</p>
                <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider">Renewing May 14, 2026</p>
              </div>
            </div>
            <Button className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-xl px-6 h-10 shrink-0">
              Manage Billing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
