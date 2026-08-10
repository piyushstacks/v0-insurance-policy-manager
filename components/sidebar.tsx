'use client';

import React, { useState, useEffect } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, 
  FileText, 
  Users, 
  Bell, 
  Settings, 
  LogOut, 
  BarChart3, 
  ChevronRight, 
  Search,
  Menu,
  X,
  Fingerprint,
  PieChart,
  CalendarDays,
  ShieldCheck,
  Lock,
  Clock,
  ListTodo,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/global-search';
import { KeyboardShortcutsModal } from '@/components/keyboard-shortcuts-modal';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useTeam } from '@/hooks/use-team';
import { ThemeToggle } from '@/components/theme-toggle';

interface SidebarProps {
  user: User;
}

const BadgeWithDot = ({ children, color = 'success' }: { children: React.ReactNode, color?: string }) => {
  const colors = {
    success: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50',
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800/50',
    gray: 'bg-muted transition-colors dark:bg-slate-800/50 text-foreground border-border dark:border-slate-700/50',
  };
  const dotColors = {
    success: 'bg-emerald-500 dark:bg-emerald-400',
    blue: 'bg-blue-500 dark:bg-blue-400',
    gray: 'bg-muted transition-colors0 dark:bg-slate-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${colors[color as keyof typeof colors]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[color as keyof typeof dotColors]}`} />
      {children}
    </span>
  );
};


export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const { isMember } = useTeam();

  const navItems = [
    ...(!isMember ? [{ 
      name: 'Home', 
      href: '/app', 
      icon: Home, 
      exact: true,
      children: [
        { name: 'Dashboard', href: '/app', icon: BarChart3, exact: true }
      ]
    }] : []),
    { divider: true },
    { name: 'Policies', href: '/app/policies', icon: FileText, exact: false },
    { name: 'Customers', href: '/app/customers', icon: Users, exact: false },
    ...(!isMember ? [
      { name: 'Financial Planning', href: '/app/financial-planning', icon: TrendingUp, exact: false }
    ] : []),
    { divider: true },
    { 
      name: 'Follow-ups', 
      href: '/app/followups', 
      icon: Clock, 
      exact: false, 
      badge: <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" title="Pending Items" /> 
    },
    { name: 'Todo', href: '/app/todos', icon: ListTodo, exact: false },
    { divider: true },
    { name: 'Renewals', href: '/app/renewals', icon: CalendarDays, exact: false },
    { name: 'Reminders', href: '/app/reminders', icon: CalendarDays, exact: false },
    ...(!isMember ? [
      { name: 'Reporting', href: '/app/reporting', icon: PieChart, exact: false },
    ] : []),
    { divider: true },
    { 
      name: 'Approvals', 
      href: '/app/approvals', 
      icon: Bell, 
      exact: false, 
      badge: <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" title="Action Required" /> 
    },
    { name: 'Settings', href: '/app/settings', icon: Settings, exact: false },
    { 
      name: 'Support', 
      href: '/app/support', 
      icon: ShieldCheck, 
      badge: <BadgeWithDot color="success">Online</BadgeWithDot> 
    },
    {
      name: 'Shortcuts',
      onClick: () => setIsShortcutsOpen(true),
      icon: Menu,
    },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  // Close mobile overlay on Escape key
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobileMenuOpen]);

  const NavLink = ({ item }: { item: any }) => {
    if (item.divider) return <div className="h-px bg-border my-4 mx-3" />;
    
    const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
    const isLocked = item.locked;
    
    const content = (
      <>
        <div className="flex items-center gap-3">
          <item.icon className={`w-5 h-5 ${isActive && !isLocked ? 'stroke-[2.5]' : 'stroke-2 group-hover:text-blue-600'}`} />
          <span className="font-semibold text-sm tracking-tight">{item.name}</span>
        </div>
        {item.badge ? item.badge : isLocked ? <Lock className="w-4 h-4 opacity-70" /> : (isActive && <ChevronRight className="w-4 h-4 opacity-70" />)}
      </>
    );

    const className = `flex items-center justify-between group px-3 py-2.5 rounded-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
      isActive && !isLocked
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20' 
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    } ${isLocked ? 'pointer-events-none' : ''}`;

    return (
      <div className={`space-y-1 ${isLocked ? 'opacity-50 grayscale' : ''}`}>
        {item.onClick ? (
          <button
            onClick={() => { item.onClick(); !isLocked && setIsMobileMenuOpen(false); }}
            className={className + " w-full text-left"}
          >
            {content}
          </button>
        ) : (
          <Link
            href={isLocked ? '#' : item.href}
            aria-current={isActive && !isLocked ? 'page' : undefined}
            aria-disabled={isLocked ? 'true' : undefined}
            className={className}
            onClick={() => !isLocked && setIsMobileMenuOpen(false)}
          >
            {content}
          </Link>
        )}
        
        {item.children && (
          <div className="pl-9 space-y-1">
            {item.children.map((child: any) => {
              const isChildActive = child.exact ? pathname === child.href : pathname?.startsWith(child.href);
              return (
                <Link
                  key={child.name}
                  href={isLocked ? '#' : child.href}
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isChildActive && !isLocked ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground/70 hover:text-foreground'
                  } ${isLocked ? 'pointer-events-none' : ''}`}
                  onClick={() => !isLocked && setIsMobileMenuOpen(false)}
                >
                  <child.icon className="w-3.5 h-3.5" />
                  {child.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Sidebar Desktop */}
      <aside
        role="navigation"
        aria-label="Sidebar navigation"
        className="hidden lg:flex inset-y-0 left-0 z-50 w-60 xl:w-72 bg-sidebar border-r border-border flex-col h-screen transition-colors"
      >
        {/* Main Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Header / Logo */}
          <div className="p-6 pb-2">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-900/20 ring-4 ring-sidebar transition-all">
                <Fingerprint className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-sidebar-foreground leading-none tracking-tight transition-colors">PolicyVault</h1>
              </div>
            </div>

            {/* Global Search */}
            <div className="mb-6">
              <GlobalSearch placeholder="Quick search… (⌘K)" />
            </div>

            {/* Nav Items */}
            <div className="space-y-1">
              {navItems.map((item, i) => <NavLink key={i} item={item} />)}
            </div>
          </div>
        </div>


        {/* Footer / User Profile */}
        <div className="p-4 border-t border-border bg-sidebar-accent/30 transition-colors">
          <div className="flex items-center gap-3 p-2">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center border-2 border-sidebar shadow-sm shrink-0 overflow-hidden transition-colors">
              <img src={`https://ui-avatars.com/api/?name=${user.email}&background=0D8ABC&color=fff`} alt="user" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-sidebar-foreground truncate leading-none mb-1 transition-colors">{user.user_metadata?.full_name || user.email?.split('@')[0]}</p>
              <p className="text-[10px] font-semibold text-muted-foreground truncate mt-0.5 transition-colors">{user.email}</p>
            </div>
            <ThemeToggle />
          <button 
              onClick={handleLogout}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-40 lg:hidden transition-all"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <KeyboardShortcutsModal open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
    </>
  );
}
