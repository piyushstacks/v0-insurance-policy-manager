'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { FileText, Home, Users, Settings, LogOut } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface AppNavProps {
  user: User;
}

export default function AppNav({ user }: AppNavProps) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const navItems = [
    { name: 'Dashboard', href: '/app', icon: Home },
    { name: 'Policies', href: '/app/policies', icon: FileText },
    { name: 'Customers', href: '/app/customers', icon: Users },
    { name: 'Reminders', href: '/app/reminders', icon: FileText },
    { name: 'Settings', href: '/app/settings', icon: Settings },
  ];

  return (
    <nav className="fixed md:static bottom-0 w-full md:w-64 bg-slate-900 border-t md:border-t-0 md:border-r border-slate-800 text-slate-300 flex flex-row md:flex-col z-50 transition-all shadow-xl md:shadow-none">
      {/* Desktop Logo */}
      <div className="hidden md:block p-6 border-b border-slate-800 tracking-tight">
        <h1 className="text-2xl font-bold text-white tracking-tighter">PolicyVault</h1>
        <p className="text-xs text-slate-400 mt-1 font-medium">Insurance Management</p>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 flex flex-row md:flex-col items-center justify-around md:justify-start md:p-4 px-2 py-2 overflow-x-auto no-scrollbar md:gap-2">
        {navItems.map((item) => {
          const isActive = false; // Add robust route checking if desired
          return (
            <Link key={item.name} href={item.href} className="w-full md:w-auto flex-1 md:flex-none">
              <Button
                variant="ghost"
                className="w-full flex-col md:flex-row justify-center md:justify-start gap-1 md:gap-3 py-6 md:py-3 h-auto md:h-10 text-slate-400 hover:text-white hover:bg-white/5 data-[active=true]:bg-blue-600 data-[active=true]:text-white rounded-xl md:rounded-lg transition-all"
              >
                <item.icon className="w-5 h-5 md:w-4 md:h-4 stroke-[2.5]" />
                <span className="text-[10px] md:text-sm font-medium">{item.name}</span>
              </Button>
            </Link>
          );
        })}
      </div>

      {/* User Section (Hidden on Mobile) */}
      <div className="hidden md:block p-4 border-t border-slate-800 space-y-4">
        <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Account</p>
          <p className="text-sm font-medium text-slate-200 truncate">{user.email}</p>
        </div>
        <Button
          onClick={handleLogout}
          variant="destructive"
          className="w-full justify-start rounded-lg shadow-sm font-medium relative group overflow-hidden"
        >
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
          <LogOut className="w-4 h-4 mr-2 relative z-10" />
          <span className="relative z-10">Sign out</span>
        </Button>
      </div>
    </nav>
  );
}
