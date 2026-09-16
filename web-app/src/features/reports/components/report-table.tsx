'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { Money } from '@/components/common/money';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { asNumber, formatCellPlain, isMoneyColumn } from '../lib/cell';
import { drillDownHref } from '../lib/drill-down';
import type { ReportColumn, ReportConfig, ReportResult, ReportRow } from '../model';

type ReportTableProps = {
  config: ReportConfig;
  result: ReportResult;
  dateRange?: { dateFrom?: string; dateTo?: string };
  groupByColumn?: string;
  compareResult?: ReportResult | null;
};

function Cell({
  column,
  value,
}: {
  column: ReportColumn;
  value: unknown;
}) {
  if (column.type === 'number' && isMoneyColumn(column.key)) {
    return <Money value={asNumber(value)} />;
  }
  const plain = formatCellPlain(value, column.type, column.key);
  return (
    <span className={cn(column.type === 'number' && 't-mono')} dir={column.type === 'number' ? 'ltr' : undefined}>
      {plain}
    </span>
  );
}

function groupRows(rows: ReportRow[], key: string): Map<string, ReportRow[]> {
  const map = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const label = formatCellPlain(row[key], 'text') || '—';
    const list = map.get(label) ?? [];
    list.push(row);
    map.set(label, list);
  }
  return map;
}

function numericSubtotals(rows: ReportRow[], columns: ReportColumn[]): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const col of columns) {
    if (col.type !== 'number') continue;
    let sum = 0;
    let any = false;
    for (const row of rows) {
      const n = asNumber(row[col.key]);
      if (n !== null) {
        sum += n;
        any = true;
      }
    }
    if (any) sums[col.key] = sum;
  }
  return sums;
}

function DeltaCell({
  current,
  previous,
  column,
}: {
  current: unknown;
  previous: unknown;
  column: ReportColumn;
}) {
  if (column.type !== 'number') return <Cell column={column} value={current} />;
  const a = asNumber(current);
  const b = asNumber(previous);
  if (a === null) return <Cell column={column} value={current} />;
  const delta = b === null ? null : a - b;
  return (
    <div className="space-y-xs">
      <Cell column={column} value={current} />
      {delta !== null ? (
        <p
          dir="ltr"
          className={cn('t-caption t-mono', delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-text-secondary')}
        >
          {delta > 0 ? '+' : ''}
          {delta.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </p>
      ) : null}
    </div>
  );
}

export function ReportTable({
  config,
  result,
  dateRange,
  groupByColumn,
  compareResult,
}: ReportTableProps) {
  const t = useTranslations();
  const columns = result.columns;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const compareIndex = useMemo(() => {
    if (!compareResult) return null;
    const map = new Map<string, ReportRow>();
    const keyCol = compareResult.columns[0]?.key ?? 'id';
    for (const row of compareResult.rows as ReportRow[]) {
      map.set(formatCellPlain(row[keyCol], 'text'), row);
    }
    return { map, keyCol };
  }, [compareResult]);

  useEffect(() => {
    if (!groupByColumn) return;
    const groups = groupRows(result.rows as ReportRow[], groupByColumn);
    const init: Record<string, boolean> = {};
    for (const key of groups.keys()) init[key] = true;
    setOpenGroups(init);
  }, [groupByColumn, result.rows]);

  if (columns.length === 0) {
    return <p className="t-body text-text-secondary">{t('web.reports.emptyRows')}</p>;
  }

  const renderRow = (row: ReportRow, index: number) => {
    const href = drillDownHref(config, row, dateRange);
    const compareRow = compareIndex
      ? compareIndex.map.get(formatCellPlain(row[compareIndex.keyCol], 'text'))
      : undefined;

    return (
      <tr key={index} className={href ? 'hover:bg-surface-alt' : undefined}>
        {columns.map((col, i) => {
          const body =
            compareResult ? (
              <DeltaCell column={col} current={row[col.key]} previous={compareRow?.[col.key]} />
            ) : (
              <Cell column={col} value={row[col.key]} />
            );
          return (
            <td key={col.key} className="border-b border-divider px-sm py-xs text-start align-top">
              {i === 0 && href ? (
                <Link href={href} className="text-primary underline-offset-2 hover:underline">
                  {body}
                </Link>
              ) : (
                body
              )}
            </td>
          );
        })}
      </tr>
    );
  };

  if (groupByColumn) {
    const groups = groupRows(result.rows as ReportRow[], groupByColumn);
    return (
      <div className="space-y-sm">
        {[...groups.entries()].map(([label, rows]) => {
          const open = openGroups[label] ?? true;
          const subs = numericSubtotals(rows, columns);
          return (
            <section key={label} className="rounded-md border border-border">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-md px-md py-sm text-start hover:bg-surface-alt"
                onClick={() => setOpenGroups((prev) => ({ ...prev, [label]: !open }))}
                aria-expanded={open}
              >
                <span className="t-body font-medium text-text-primary">{label}</span>
                <span className="t-caption text-text-secondary">
                  {t('web.reports.rowsInGroup', { count: rows.length })}
                </span>
              </button>
              {open ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse t-caption">
                    <thead>
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            scope="col"
                            className="border-b border-border bg-surface-alt px-sm py-xs text-start font-medium"
                          >
                            {col.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>{rows.map((row, i) => renderRow(row, i))}</tbody>
                    {Object.keys(subs).length > 0 ? (
                      <tfoot>
                        <tr>
                          {columns.map((col, i) => (
                            <td
                              key={col.key}
                              className="border-t border-border bg-surface-alt px-sm py-xs font-medium"
                            >
                              {i === 0
                                ? t('web.reports.subtotal')
                                : subs[col.key] !== undefined
                                  ? (
                                      <Cell column={col} value={subs[col.key]} />
                                    )
                                  : null}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse t-caption">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="border-b border-border bg-surface-alt px-sm py-xs text-start font-medium"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{(result.rows as ReportRow[]).map((row, i) => renderRow(row, i))}</tbody>
      </table>
    </div>
  );
}
