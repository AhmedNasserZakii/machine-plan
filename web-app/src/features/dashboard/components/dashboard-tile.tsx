'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { CardGridSkeleton } from '@/components/feedback/skeletons';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type DashboardTileProps = {
  title: string;
  viewAllHref?: string;
  count?: number;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyBody?: string;
  emptyTone?: 'neutral' | 'success';
  isEmpty?: boolean;
  className?: string;
  children?: ReactNode;
};

export function DashboardTile({
  title,
  viewAllHref,
  count,
  isLoading,
  error,
  onRetry,
  emptyTitle,
  emptyBody,
  emptyTone = 'success',
  isEmpty,
  className,
  children,
}: DashboardTileProps) {
  const t = useTranslations();

  if (isLoading) {
    return <CardGridSkeleton count={1} className={cn('grid-cols-1', className)} />;
  }

  if (error) {
    return (
      <section className={cn('rounded-md border border-border bg-surface p-lg', className)}>
        <ErrorState error={error} onRetry={onRetry} />
      </section>
    );
  }

  const titleNode = viewAllHref ? (
    <Link href={viewAllHref} className="hover:underline">
      {title}
      {typeof count === 'number' ? (
        <span className="ms-sm t-mono text-text-secondary">({count})</span>
      ) : null}
    </Link>
  ) : (
    <>
      {title}
      {typeof count === 'number' ? (
        <span className="ms-sm t-mono text-text-secondary">({count})</span>
      ) : null}
    </>
  );

  return (
    <section className={cn('rounded-md border border-border bg-surface p-lg', className)}>
      <div className="mb-md flex items-baseline justify-between gap-md">
        <h2 className="t-h3">{titleNode}</h2>
        {viewAllHref ? (
          <Link href={viewAllHref} className="t-caption text-primary hover:underline">
            {t('web.dashboard.viewAll')}
          </Link>
        ) : null}
      </div>
      {isEmpty && emptyTitle ? (
        <EmptyState tone={emptyTone} title={emptyTitle} description={emptyBody} />
      ) : (
        children
      )}
    </section>
  );
}
