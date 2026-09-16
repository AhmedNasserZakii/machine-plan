import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function TableSkeleton({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn('w-full overflow-hidden rounded-md border border-border', className)} aria-hidden>
      <div className="flex gap-md border-b border-border bg-surface-alt px-md py-sm">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 flex-1 bg-shimmer-base" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={`r-${row}`} className="flex gap-md border-b border-border px-md py-md last:border-b-0">
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton key={`c-${row}-${col}`} className="h-4 flex-1 bg-shimmer-base" />
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
        <Skeleton className="h-8 w-1/3 bg-shimmer-base" />
        <Skeleton className="h-4 w-1/2 bg-shimmer-base" />
      </div>
      <div className="grid gap-md md:grid-cols-[1fr_280px]">
        <div className="space-y-md rounded-md border border-border bg-surface p-lg">
          <Skeleton className="h-4 w-full bg-shimmer-base" />
          <Skeleton className="h-4 w-5/6 bg-shimmer-base" />
          <Skeleton className="h-4 w-2/3 bg-shimmer-base" />
          <Skeleton className="h-32 w-full bg-shimmer-base" />
        </div>
        <div className="space-y-md rounded-md border border-border bg-surface p-lg">
          <Skeleton className="h-4 w-full bg-shimmer-base" />
          <Skeleton className="h-4 w-3/4 bg-shimmer-base" />
          <Skeleton className="h-4 w-1/2 bg-shimmer-base" />
        </div>
      </div>
    </div>
  );
}

export function CardGridSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-md sm:grid-cols-2 xl:grid-cols-4', className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-sm rounded-md border border-border bg-surface p-lg">
          <Skeleton className="h-4 w-1/2 bg-shimmer-base" />
          <Skeleton className="h-8 w-1/3 bg-shimmer-base" />
          <Skeleton className="h-4 w-full bg-shimmer-base" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-md border border-border bg-surface p-lg', className)} aria-hidden>
      <Skeleton className="mb-md h-4 w-1/4 bg-shimmer-base" />
      <Skeleton className="h-48 w-full bg-shimmer-base" />
    </div>
  );
}
