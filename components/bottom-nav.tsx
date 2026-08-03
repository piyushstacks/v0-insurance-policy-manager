'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard: close on Escape
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [moreOpen]);

  // Focus first interactive element when More sheet opens
  useEffect(() => {
    if (moreOpen) {
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
  }, [moreOpen]);

  // Focus trap inside More sheet
  const handleSheetKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const sheet = e.currentTarget;
    const focusable = sheet.querySelectorAll<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      {/* More sheet — accessible dialog */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More navigation options"
            onKeyDown={handleSheetKeyDown}
            className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] border-t border-border animate-in slide-in-from-bottom-full duration-300"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-xl font-black text-foreground tracking-tight">More options</h2>
              <button
                ref={closeButtonRef}
                onClick={() => { setMoreOpen(false); moreButtonRef.current?.focus(); }}
                className="p-2 -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:bg-muted rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                aria-label="Close more options"
              >
                <X className="w-6 h-6" aria-hidden="true" />
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
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center py-4 px-4 rounded-2xl gap-4 min-h-[56px] transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                      isActive ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <div className={`flex items-center justify-center p-2 rounded-xl ${isActive ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'bg-muted text-muted-foreground'}`}>
                      <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                    </div>
                    <span className={`text-base font-semibold ${isActive ? 'text-blue-600' : ''}`}>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom navigation bar */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#050505]/80 backdrop-blur-2xl border-t border-slate-200 dark:border-white/10 px-1 z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch justify-around h-[64px]">
          {PRIMARY_NAV.map((item) => {
            if (!item.href) {
              // More button
              return (
                <button
                  key="more"
                  ref={moreButtonRef}
                  type="button"
                  onClick={() => setMoreOpen(v => !v)}
                  aria-expanded={moreOpen}
                  aria-haspopup="dialog"
                  aria-label="More navigation options"
                  className={`flex flex-col items-center justify-center py-1.5 px-2 min-w-[56px] flex-1 transition-all duration-200 rounded-xl mx-0.5 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                    moreOpen ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground/90'
                  }`}
                >
                  <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all ${moreOpen ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}>
                    <item.icon className={`w-5 h-5 ${moreOpen ? 'stroke-[2.5]' : 'stroke-2'}`} aria-hidden="true" />
                  </div>
                  <span className={`text-xs font-bold mt-0.5 tracking-tight ${moreOpen ? 'opacity-100' : 'opacity-60'}`}>
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
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.name}
                className={`flex flex-col items-center justify-center py-1.5 px-2 min-w-[56px] flex-1 transition-all duration-200 rounded-xl mx-0.5 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                  isActive ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground/90'
                }`}
              >
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all ${isActive ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}>
                  <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} aria-hidden="true" />
                </div>
                <span className={`text-xs font-bold mt-0.5 tracking-tight ${isActive ? 'opacity-100' : 'opacity-60'}`}>
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
