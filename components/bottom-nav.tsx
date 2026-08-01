'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  FileText, 
  Users, 
  Bell, 
  MoreHorizontal,
  CalendarDays,
  Settings,
  BarChart3,
  ShieldCheck,
  Clock,
  ListTodo,
  HelpCircle,
  X
} from 'lucide-react';

const PRIMARY_NAV = [
  { name: 'Home',      href: '/app',             icon: Home,          exact: true },
  { name: 'Policies',  href: '/app/policies',     icon: FileText,      exact: false },
  { name: 'Customers', href: '/app/customers',    icon: Users,         exact: false },
  { name: 'Reminders', href: '/app/reminders',    icon: Bell,          exact: false },
  { name: 'More',      href: null,                icon: MoreHorizontal, exact: false },
];

const MORE_NAV = [
  { name: 'Follow-ups',  href: '/app/followups',  icon: Clock },
  { name: 'Todo',        href: '/app/todos',      icon: ListTodo },
  { name: 'Renewals',    href: '/app/renewals',   icon: CalendarDays },
  { name: 'Reporting',   href: '/app/reporting',  icon: BarChart3 },
  { name: 'Approvals',   href: '/app/approvals',  icon: ShieldCheck },
  { name: 'Settings',    href: '/app/settings',   icon: Settings },
  { name: 'Support',     href: '/app/support',    icon: HelpCircle },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* More sheet */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card transition-colors rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] border-t border-border animate-in slide-in-from-bottom-full duration-300" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-xl font-black text-foreground tracking-tight">More options</h2>
              <button onClick={() => setMoreOpen(false)} className="p-2 -mr-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-3 grid grid-cols-1 gap-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {MORE_NAV.map(item => {
                const isActive = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center py-4 px-4 rounded-2xl gap-4 transition-all ${
                      isActive ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-foreground hover:bg-muted transition-colors'
                    }`}
                  >
                    <div className={`flex items-center justify-center p-2 rounded-xl ${isActive ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'bg-muted text-muted-foreground'}`}>
                      <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className={`text-base font-semibold ${isActive ? 'text-blue-600' : ''}`}>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#050505]/80 backdrop-blur-2xl border-t border-slate-200 dark:border-white/10 px-1 z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch justify-around h-[60px]">
          {PRIMARY_NAV.map((item) => {
            if (!item.href) {
              // More button
              return (
                <button
                  key="more"
                  type="button"
                  onClick={() => setMoreOpen(v => !v)}
                  className={`flex flex-col items-center justify-center py-1.5 px-2 min-w-[56px] flex-1 transition-all duration-200 ${
                    moreOpen ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground/90'
                  }`}
                >
                  <div className={`relative flex items-center justify-center p-1 rounded-xl transition-all ${moreOpen ? 'bg-blue-50' : ''}`}>
                    <item.icon className={`w-5 h-5 ${moreOpen ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  </div>
                  <span className={`text-[10px] font-bold mt-0.5 tracking-tight ${moreOpen ? 'opacity-100' : 'opacity-60'}`}>
                    {item.name}
                  </span>
                </button>
              );
            }

            const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={`flex flex-col items-center justify-center py-1.5 px-2 min-w-[56px] flex-1 transition-all duration-200 ${
                  isActive ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground/90'
                }`}
              >
                <div className={`relative flex items-center justify-center p-1 rounded-xl transition-all ${isActive ? 'bg-blue-50' : ''}`}>
                  <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                </div>
                <span className={`text-[10px] font-bold mt-0.5 tracking-tight ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
