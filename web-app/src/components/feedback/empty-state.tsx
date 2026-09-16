'use client';

import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** When true, marks filtered-empty (caller supplies filtered copy). */
  filtered?: boolean;
  /** Good-news empty (e.g. no pending transfers) uses success tone. */
  tone?: 'neutral' | 'success';
  className?: string;
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  filtered = false,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      data-filtered={filtered || undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-md rounded-md border border-dashed border-border px-lg py-xxl text-center',
        tone === 'success' ? 'bg-success-surface text-text-primary' : 'bg-surface text-text-primary',
        className,
      )}
    >
      <Icon
        className={cn('size-10', tone === 'success' ? 'text-success' : 'text-text-disabled')}
        aria-hidden
      />
      <div className="max-w-md space-y-xs">
        <h2 className="t-h3">{title}</h2>
        {description ? (
          <p className={cn('t-body', tone === 'success' ? 'text-text-secondary' : 'text-text-secondary')}>
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function FilteredEmptyState({ onClear }: { onClear?: () => void }) {
  const t = useTranslations();
  return (
    <EmptyState
      filtered
      title={t('web.filters.filteredEmptyTitle')}
      description={t('web.filters.filteredEmptyBody')}
      action={
        onClear ? (
          <Button type="button" variant="outline" onClick={onClear}>
            {t('web.filters.clearAll')}
          </Button>
        ) : null
      }
    />
  );
}
