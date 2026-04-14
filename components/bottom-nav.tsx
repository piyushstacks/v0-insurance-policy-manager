'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  FileText, 
  Users, 
  Bell, 
  Settings,
  LayoutGrid
} from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/app', icon: LayoutGrid, exact: true },
    { name: 'Policies', href: '/app/policies', icon: FileText, exact: false },
    { name: 'Customers', href: '/app/customers', icon: Users, exact: false },
    { name: 'Reminders', href: '/app/reminders', icon: Bell, exact: false },
    { name: 'Settings', href: '/app/settings', icon: Settings, exact: false },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-1 z-40 safe-area-pb shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`flex flex-col items-center justify-center py-2 px-1 min-w-[64px] transition-all duration-200 ${
                isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`relative flex items-center justify-center p-1 rounded-xl transition-all ${isActive ? 'bg-blue-50' : ''}`}>
                <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              </div>
              <span className={`text-[10px] font-bold mt-1 tracking-tight ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
