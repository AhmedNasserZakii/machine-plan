'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { CSSProperties, ReactNode } from 'react';

import { ChartSkeleton } from '@/components/feedback/table-skeleton';
import { cn } from '@/lib/utils';

export const CHART_COLORS = [
  'var(--color-primary)',
  'var(--color-secondary)',
  'var(--color-info)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-danger)',
] as const;

export type ChartTableRow = {
  label: string;
  values: Record<string, string | number>;
};

type ChartContainerProps = {
  title?: string;
  height?: number;
  loading?: boolean;
  children: ReactNode;
  table: {
    columns: { key: string; label: string }[];
    rows: ChartTableRow[];
  };
  className?: string;
};

/** Wraps Recharts charts: token palette via CHART_COLORS, RTL axis flip, table fallback. */
export function ChartContainer({
  title,
  height = 288,
  loading,
  children,
  table,
  className,
}: ChartContainerProps) {
  const t = useTranslations();
  const locale = useLocale();
  const rtl = locale.startsWith('ar');

  return (
    <figure
      className={cn('rounded-md border border-border bg-surface p-md', className)}
      data-rtl={rtl || undefined}
      style={
        {
          ['--chart-axis-direction']: rtl ? 'rtl' : 'ltr',
        } as CSSProperties
      }
    >
      {title ? <figcaption className="mb-sm t-h3">{title}</figcaption> : null}
      <div style={{ height }} className="w-full min-h-0" dir={rtl ? 'rtl' : 'ltr'}>
        {loading ? <ChartSkeleton className="h-full" /> : children}
      </div>
      <details className="mt-md">
        <summary className="cursor-pointer t-caption text-text-secondary">
          {t('web.common.chartTableFallback')}
        </summary>
        <div className="mt-sm overflow-x-auto">
          <table className="w-full border-collapse t-caption">
            <thead>
              <tr>
                <th scope="col" className="border-b border-border px-sm py-xs text-start">
                  —
                </th>
                {table.columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className="border-b border-border px-sm py-xs text-start"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="border-b border-divider px-sm py-xs text-start font-medium">
                    {row.label}
                  </th>
                  {table.columns.map((col) => (
                    <td key={col.key} className="border-b border-divider px-sm py-xs t-mono" dir="ltr">
                      {row.values[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
