'use client';

import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface FilterChipProps {
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
  onClear?: () => void;
  className?: string;
}

export function FilterChip({
  label,
  active = false,
  count,
  onClick,
  onClear,
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-150 whitespace-nowrap select-none',
        active
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200'
          : 'bg-card transition-colors text-foreground/90 border-border hover:border-blue-300 hover:text-blue-600',
        className
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black',
            active ? 'bg-card transition-colors/20 text-white' : 'bg-muted transition-colors text-muted-foreground'
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
      {active && onClear && (
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="ml-0.5 hover:bg-card transition-colors/20 rounded-full p-0.5 transition-colors"
        >
          <X className="w-2.5 h-2.5" />
        </span>
      )}
    </button>
  );
}

interface FilterChipGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterChipGroup({ children, className }: FilterChipGroupProps) {
  return (
    <div className={cn('flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar', className)}>
      {children}
    </div>
  );
}
