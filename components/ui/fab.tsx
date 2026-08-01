'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, X, UserPlus, FileText, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FabAction {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

interface FabProps {
  actions?: FabAction[];
  className?: string;
}

const DEFAULT_ACTIONS: FabAction[] = [
  {
    label: 'New Customer',
    icon: <UserPlus className="w-4 h-4" />,
    href: '/app/customers',
  },
  {
    label: 'New Policy',
    icon: <FileText className="w-4 h-4" />,
    href: '/app/policies/new',
  },
  {
    label: 'Upload Document',
    icon: <Upload className="w-4 h-4" />,
    href: '/app/extract',
  },
];

export function Fab({ actions = DEFAULT_ACTIONS, className }: FabProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('lg:hidden fixed bottom-20 right-4 z-50 flex flex-col-reverse items-end gap-3', className)}>
      {/* Action items */}
      {open && actions.map((action, i) => {
        const inner = (
          <div
            key={i}
            className="flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="bg-slate-800 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow whitespace-nowrap">
              {action.label}
            </span>
            <div className="w-10 h-10 rounded-full bg-card transition-colors border border-border shadow-md flex items-center justify-center text-foreground">
              {action.icon}
            </div>
          </div>
        );

        if (action.href) {
          return (
            <Link key={i} href={action.href} onClick={() => setOpen(false)}>
              {inner}
            </Link>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => { action.onClick?.(); setOpen(false); }}
          >
            {inner}
          </button>
        );
      })}

      {/* Main FAB button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-[56px] h-[56px] rounded-full bg-blue-600 text-white shadow-[0_8px_30px_rgba(37,99,235,0.4)] dark:shadow-[0_8px_30px_rgba(37,99,235,0.2)] flex items-center justify-center transition-all duration-300 active:scale-95 hover:bg-blue-700',
          open && 'rotate-45 bg-slate-800 dark:bg-slate-100 dark:text-slate-900 shadow-none'
        )}
        aria-label="Quick actions"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
