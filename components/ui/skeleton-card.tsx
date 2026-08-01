import { cn } from '@/lib/utils';

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-accent',
        className
      )}
    />
  );
}

interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 3, className }: SkeletonCardProps) {
  return (
    <div className={cn('bg-card transition-colors rounded-xl border border-border p-4 space-y-3 shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-5 w-14 rounded-full" />
      </div>
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className={cn('h-3', i === lines - 2 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

export function SkeletonHero({ className }: { className?: string }) {
  return (
    <div className={cn('bg-card transition-colors rounded-2xl border border-border p-6 shadow-sm space-y-4', className)}>
      <SkeletonBlock className="h-3 w-20" />
      <SkeletonBlock className="h-10 w-48" />
      <SkeletonBlock className="h-10 w-full rounded-lg" />
      <div className="flex gap-3 pt-1">
        {[1, 2, 3, 4].map(i => (
          <SkeletonBlock key={i} className="h-16 flex-1 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 py-3 px-4', className)}>
      <SkeletonBlock className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="h-2.5 w-20" />
      </div>
      <SkeletonBlock className="h-3 w-16" />
    </div>
  );
}
