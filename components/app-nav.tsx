'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { FileText, Home, Users, Settings, LogOut, Navigation2, FileSpreadsheet, Fingerprint, CalendarDays } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { FileText, Home, Users, Settings, LogOut } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface AppNavProps {
  user: User;
}

export default function AppNav({ user }: AppNavProps) {
  const router = useRouter();

  const pathname = usePathname();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  const navItems = [
    { name: 'Dashboard', href: '/app', icon: Home, exact: true },
    { name: 'Policies', href: '/app/policies', icon: FileSpreadsheet, exact: false },
    { name: 'Customers', href: '/app/customers', icon: Users, exact: false },
    { name: 'Reminders', href: '/app/reminders', icon: CalendarDays, exact: false },
    { name: 'Settings', href: '/app/settings', icon: Settings, exact: false },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-xl border-b border-slate-200 shadow-sm transition-all">
      <div className="mx-auto max-w-[1600px] px-4 md:px-8">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex shrink-0 items-center gap-2 mr-4">
             <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
               <Fingerprint className="w-5 h-5" />
             </div>
             <div className="hidden md:flex flex-col tracking-tight">
                <h1 className="text-xl font-extrabold text-slate-900 leading-none">PolicyVault</h1>
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none mt-0.5">Manager</span>
             </div>
          </div>

          {/* Center Links */}
          <div className="flex-1 flex items-center justify-center gap-1 overflow-x-auto no-scrollbar mask-edges">
            {navItems.map((item) => {
              const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
              return (
                <Link key={item.name} href={item.href} className="shrink-0">
                  <span
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                      isActive 
                        ? 'bg-indigo-50/80 text-indigo-700 shadow-sm ring-1 ring-indigo-100' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                    <span className="hidden sm:inline-block">{item.name}</span>
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Right Profile Controls */}
          <div className="flex shrink-0 items-center justify-end gap-4 ml-4">
            <div className="hidden lg:flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signed In</span>
              <span className="text-sm font-semibold text-slate-700">{user.email}</span>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-colors shadow-sm"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
