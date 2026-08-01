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
  ShieldCheck
} from 'lucide-react';

const PRIMARY_NAV = [
  { name: 'Home',      href: '/app',             icon: Home,          exact: true },
  { name: 'Policies',  href: '/app/policies',     icon: FileText,      exact: false },
  { name: 'Customers', href: '/app/customers',    icon: Users,         exact: false },
  { name: 'Reminders', href: '/app/reminders',    icon: Bell,          exact: false },
  { name: 'More',      href: null,                icon: MoreHorizontal, exact: false },
];

const MORE_NAV = [
  { name: 'Renewals',  href: '/app/renewals',     icon: CalendarDays },
  { name: 'Reporting', href: '/app/reporting',    icon: BarChart3 },
  { name: 'Approvals', href: '/app/approvals',    icon: ShieldCheck },
  { name: 'Settings',  href: '/app/settings',     icon: Settings },
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
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed bottom-[65px] left-2 right-2 z-50 lg:hidden bg-card transition-colors rounded-2xl shadow-2xl border border-border p-3 grid grid-cols-4 gap-1 animate-in slide-in-from-bottom-4 duration-200">
            {MORE_NAV.map(item => {
              const isActive = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl gap-1.5 transition-all ${
                    isActive ? 'bg-blue-50 text-blue-600' : 'text-muted-foreground hover:bg-muted transition-colors'
                  }`}
                >
                  <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px] font-bold">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Bottom bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card transition-colors/95 backdrop-blur border-t border-border px-1 z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-stretch justify-around h-14">
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
