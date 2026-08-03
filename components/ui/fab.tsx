'use client';

import { useState, useEffect, useRef } from 'react';
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
    icon: <UserPlus className="w-4 h-4" aria-hidden="true" />,
    href: '/app/customers',
  },
  {
    label: 'New Policy',
    icon: <FileText className="w-4 h-4" aria-hidden="true" />,
    href: '/app/policies/new',
  },
  {
    label: 'Upload Document',
    icon: <Upload className="w-4 h-4" aria-hidden="true" />,
    href: '/app/extract',
  },
];

export function Fab({ actions = DEFAULT_ACTIONS, className }: FabProps) {
  const [open, setOpen] = useState(false);
  const mainButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        mainButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    /*
     * Position: above the bottom nav (64px) + safe-area-inset-bottom + 12px gap
     * This ensures FAB never overlaps the nav bar on any device including notched phones.
     */
    <div
      className={cn(
        'lg:hidden fixed right-4 z-50 flex flex-col-reverse items-end gap-3',
        className
      )}
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)' }}
      role="group"
      aria-label="Quick actions"
    >
      {/* Action items */}
      {open && actions.map((action, i) => {
        const inner = (
          <div
            className="flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap">
              {action.label}
            </span>
            <div className="w-11 h-11 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground">
              {action.icon}
            </div>
          </div>
        );

        if (action.href) {
          return (
            <Link
              key={i}
              href={action.href}
              role="menuitem"
              aria-label={action.label}
              onClick={() => setOpen(false)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full"
            >
              {inner}
            </Link>
          );
        }
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            aria-label={action.label}
            onClick={() => { action.onClick?.(); setOpen(false); }}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full"
          >
            {inner}
          </button>
        );
      })}

      {/* Main FAB button */}
      <button
        ref={mainButtonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? 'Close quick actions' : 'Open quick actions'}
        className={cn(
          'w-[56px] h-[56px] rounded-full bg-blue-600 text-white shadow-[0_8px_30px_rgba(37,99,235,0.4)] dark:shadow-[0_8px_30px_rgba(37,99,235,0.2)] flex items-center justify-center transition-all duration-300 active:scale-95 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none',
          open && 'rotate-45 bg-slate-800 dark:bg-slate-100 dark:text-slate-900 shadow-none'
        )}
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} aria-hidden="true" />
      </button>

      {/* Backdrop — closes FAB when tapping outside */}
      {open && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
