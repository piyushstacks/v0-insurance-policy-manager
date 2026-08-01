'use client';

import React from 'react';
import { ShieldCheck, MessageSquare, BookOpen, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SupportPage() {
  const supportCards = [
    { title: 'Live Chat', desc: 'Typical response time: 5 mins', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Knowledge Base', desc: 'Read guides and documentation', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Email Support', desc: 'support@policyvault.ai', icon: Mail, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="flex-1 p-6 md:p-12 bg-background">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-200 ring-8 ring-white">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">Support Center</h1>
            <p className="font-medium text-muted-foreground">We're here to help you manage your policy engine.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {supportCards.map((card) => (
            <div key={card.title} className="bg-card transition-colors p-6 rounded-3xl border border-border hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
              <div className={`w-12 h-12 ${card.bg} ${card.color} rounded-2xl flex items-center justify-center mb-4`}>
                <card.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-foreground mb-1">{card.title}</h3>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed">{card.desc}</p>
              <Button variant="ghost" className="mt-4 p-0 h-auto text-blue-600 font-bold hover:bg-transparent hover:text-blue-700">
                Contact Support →
              </Button>
            </div>
          ))}
        </div>

        <div className="bg-slate-900 rounded-[32px] p-8 md:p-12 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10">
            <h2 className="text-2xl font-black mb-4">Need personalized assistance?</h2>
            <p className="text-muted-foreground mb-8 max-w-lg leading-relaxed font-medium">
              Our technical architects are available to help you with custom API integrations or bulk document migrations.
            </p>
            <Button variant="primary" size="lg" className="rounded-2xl px-10 shadow-2xl shadow-blue-500/20 w-max">
              Submit Request
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
