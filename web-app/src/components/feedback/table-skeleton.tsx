'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type TableSkeletonProps = {
  columns?: number;
  rows?: number;
  density?: 'compact' | 'comfortable';
  className?: string;
};

export function TableSkeleton({
  columns = 5,
  rows = 8,
  density = 'comfortable',
  className,
}: TableSkeletonProps) {
  const rowH = density === 'compact' ? 'h-10' : 'h-[52px]';
  return (
    <div className={cn('w-full overflow-hidden rounded-md border border-border', className)} aria-hidden>
      <div className="flex gap-md border-b border-border bg-surface-alt px-md py-sm">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={cn('flex items-center gap-md border-b border-divider px-md', rowH)}>
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-lg', className)} aria-hidden>
      <div className="space-y-sm">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid gap-lg lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-md">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({
  cards = 6,
  className,
}: {
  cards?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('grid gap-md sm:grid-cols-2 xl:grid-cols-3', className)}
      aria-hidden
    >
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-md" />
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-72 w-full rounded-md', className)} aria-hidden />;
}
