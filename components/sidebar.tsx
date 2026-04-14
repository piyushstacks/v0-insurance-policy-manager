'use client';

import React, { useState } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface SidebarProps {
  user: User;
}

const BadgeWithDot = ({ children, color = 'success' }: { children: React.ReactNode, color?: string }) => {
  const colors = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    gray: 'bg-slate-50 text-slate-700 border-slate-100',
  };
  const dotColors = {
    success: 'bg-emerald-500',
    blue: 'bg-blue-500',
    gray: 'bg-slate-500',
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

  const navItems = [
    { 
      name: 'Home', 
      href: '/app', 
      icon: Home, 
      exact: true,
      children: [
        { name: 'Dashboard', href: '/app', icon: BarChart3, exact: true }
      ]
    },
    { name: 'Policies', href: '/app/policies', icon: FileText, exact: false },
    { divider: true },
    { name: 'Customers', href: '/app/customers', icon: Users, exact: false },
    { name: 'Reminders', href: '/app/reminders', icon: CalendarDays, exact: false },
    { name: 'Reporting', href: '/app/reporting', icon: PieChart, exact: false },
    { divider: true },
    { name: 'Settings', href: '/app/settings', icon: Settings, exact: false },
    { 
      name: 'Support', 
      href: '/app/support', 
      icon: ShieldCheck, 
      badge: <BadgeWithDot color="success">Online</BadgeWithDot> 
    },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const NavLink = ({ item }: { item: any }) => {
    if (item.divider) return <div className="h-px bg-slate-100 my-4 mx-3" />;
    
    const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
    
    return (
      <div className="space-y-1">
        <Link
          href={item.href}
          className={`flex items-center justify-between group px-3 py-2 rounded-xl transition-all duration-200 ${
            isActive 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div className="flex items-center gap-3">
            <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2 group-hover:text-blue-600'}`} />
            <span className="font-semibold text-sm tracking-tight">{item.name}</span>
          </div>
          {item.badge ? item.badge : (isActive && <ChevronRight className="w-4 h-4 opacity-70" />)}
        </Link>
        
        {item.children && (
          <div className="pl-9 space-y-1">
            {item.children.map((child: any) => {
              const isChildActive = child.exact ? pathname === child.href : pathname?.startsWith(child.href);
              return (
                <Link
                  key={child.name}
                  href={child.href}
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isChildActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
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
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between px-4 h-16 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md">
            <Fingerprint className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">PolicyVault</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Desktop / Mobile Overlay */}
      <aside className={`
        fixed inset-y-0 right-0 z-50 w-72 bg-white border-l border-slate-200 flex flex-col transition-transform duration-300 ease-in-out
        lg:left-0 lg:right-auto lg:border-r lg:border-l-0 lg:translate-x-0 lg:static lg:h-screen
        ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        {/* Header / Logo */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-100 ring-4 ring-white">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-none tracking-tight">PolicyVault</h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Engine</span>
              </div>
            </div>
          </div>

          {/* Search Bar - Mimicking reference UI */}
          <div className="relative group mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Quick search... (⌘K)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-600 placeholder:text-slate-400"
            />
          </div>

          {/* Nav Items */}
          <div className="space-y-1">
            {navItems.map((item, i) => <NavLink key={i} item={item} />)}
          </div>
        </div>

        {/* Bottom Banner - Mimicking Reference UI "Performance" label */}
        <div className="mt-auto p-4">
          <div className="bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/20 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-700" />
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Live Status</span>
            </div>
            <p className="text-[22px] font-black leading-tight text-white mb-0.5">99.1<span className="text-sm font-medium text-slate-400 ml-0.5">%</span></p>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">Extraction Efficiency</p>
          </div>
        </div>

        {/* Footer / User Profile */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 p-2">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center border-2 border-white shadow-sm shrink-0 overflow-hidden">
              <img src={`https://ui-avatars.com/api/?name=${user.email}&background=0D8ABC&color=fff`} alt="user" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate leading-none mb-1">{user.email?.split('@')[0]}</p>
              <p className="text-[10px] font-semibold text-slate-500 truncate mt-0.5">Admin Account</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
