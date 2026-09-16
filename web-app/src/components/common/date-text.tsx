'use client';

import { useLocale } from 'next-intl';

import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

type DateTextProps = {
  value: string | Date | null | undefined;
  format?: 'date' | 'datetime' | 'relative';
  className?: string;
};

export function DateText({ value, format = 'date', className }: DateTextProps) {
  const locale = useLocale();
  if (!value) return <span className={cn('text-text-secondary', className)}>—</span>;

  const date = typeof value === 'string' ? new Date(value) : value;
  const iso = date.toISOString();
  const label =
    format === 'datetime'
      ? formatDateTime(date, locale)
      : format === 'relative'
        ? formatRelative(date, locale)
        : formatDate(date, locale);

  return (
    <time dateTime={iso} title={iso} className={cn(className)}>
      {label}
    </time>
  );
}
