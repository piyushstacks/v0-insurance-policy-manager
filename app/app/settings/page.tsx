'use client';

import React from 'react';
import { 
  Settings, 
  User, 
  Shield, 
  Zap, 
  Database, 
  Bell, 
  Cpu,
  Globe,
  Key,
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SettingsPage() {
  const sections = [
    {
      id: 'profile',
      title: 'Profile Information',
      icon: User,
      fields: [
        { label: 'Display Name', value: 'Piyush Stacks', type: 'text' },
        { label: 'Email Address', value: 'admin@policyvault.ai', type: 'email' },
      ]
    },
    {
      id: 'ai',
      title: 'AI Extraction Engine',
      icon: Cpu,
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-bold text-blue-900">Live Consensus Engine Active</span>
            </div>
            <p className="text-xs text-blue-700 font-medium">Multiple models (GPT-OSS, Nemotron) are currently cross-verifying your documents for maximum accuracy.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-white border border-slate-200 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">OCR Provider</p>
              <p className="text-sm font-bold text-slate-800">Google Document AI</p>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Extraction Confidence</p>
              <p className="text-sm font-bold text-emerald-600">High (98.4%)</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'security',
      title: 'Security & Access',
      icon: Shield,
      content: (
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start rounded-xl border-slate-200 h-11 text-sm font-bold">
            <Key className="w-4 h-4 mr-3 text-slate-400" /> Change Password
          </Button>
          <Button variant="outline" className="w-full justify-start rounded-xl border-slate-200 h-11 text-sm font-bold">
            <Database className="w-4 h-4 mr-3 text-slate-400" /> Backup My Data
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/50 pb-32">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-200">
            <Settings className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Settings</h1>
            <p className="font-medium text-slate-500">Global preferences and engine configuration.</p>
          </div>
        </div>

        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.id} className="bg-white rounded-[32px] p-6 md:p-8 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <section.icon className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-black text-slate-800 leading-none">{section.title}</h2>
              </div>

              {section.fields ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {section.fields.map((field) => (
                    <div key={field.label}>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                        {field.label}
                      </label>
                      <Input 
                        defaultValue={field.value} 
                        className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold focus:ring-blue-500/10 focus:border-blue-500 transition-all" 
                      />
                    </div>
                  ))}
                </div>
              ) : section.content}
            </div>
          ))}

          <div className="bg-emerald-900 rounded-[32px] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-xl leading-none mb-1">Standard Pro Plan</p>
                <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider">Renewing on May 14, 2026</p>
              </div>
            </div>
            <Button className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-xl px-8 h-12 shrink-0">
              Manage Billing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
