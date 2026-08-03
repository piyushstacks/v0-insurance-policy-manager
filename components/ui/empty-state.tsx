import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { FileText } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = FileText,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="region"
      aria-label={title}
      className={cn(
        /* Generous padding ensures readability even on 320px screens */
        'flex flex-col items-center justify-center py-12 px-6 text-center min-h-[200px]',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4 shrink-0" aria-hidden="true">
        <Icon className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-foreground mb-2 leading-snug">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      )}
      {action && (
        <div className="mt-6 w-full max-w-[240px]">
          {action}
        </div>
      )}
    </div>
  );
}
