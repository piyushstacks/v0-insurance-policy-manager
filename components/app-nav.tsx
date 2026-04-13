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

  return (
    <nav className="w-64 bg-slate-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold">PolicyVault</h1>
        <p className="text-xs text-slate-400 mt-1">Insurance Management</p>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 p-4">
        <div className="space-y-2">
          <Link href="/app" className="block">
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <Home className="w-5 h-5 mr-3" />
              Dashboard
            </Button>
          </Link>

          <Link href="/app/policies" className="block">
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <FileText className="w-5 h-5 mr-3" />
              Policies
            </Button>
          </Link>

          <Link href="/app/customers" className="block">
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <Users className="w-5 h-5 mr-3" />
              Customers
            </Button>
          </Link>

          <Link href="/app/reminders" className="block">
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <FileText className="w-5 h-5 mr-3" />
              Reminders
            </Button>
          </Link>

          <Link href="/app/settings" className="block">
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <Settings className="w-5 h-5 mr-3" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* User Section */}
      <div className="p-4 border-t border-slate-700">
        <div className="mb-4 p-3 rounded bg-slate-800">
          <p className="text-xs text-slate-400">Logged in as</p>
          <p className="text-sm font-medium truncate">{user.email}</p>
        </div>
        <Button
          onClick={handleLogout}
          variant="destructive"
          className="w-full justify-start"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Button>
      </div>
    </nav>
  );
}
