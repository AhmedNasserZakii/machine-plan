'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CHART_COLORS, ChartContainer } from '@/components/charts/chart-container';
import { formatMoney } from '@/lib/format';

import { asNumber, formatCellPlain, isMoneyColumn } from '../lib/cell';
import type { ReportResult, ReportRow } from '../model';

type ReportChartProps = {
  result: ReportResult;
  title?: string;
};

export function ReportChart({ result, title }: ReportChartProps) {
  const t = useTranslations();
  const locale = useLocale();

  const labelKey = result.columns[0]?.key ?? 'label';
  const numericCols = result.columns.filter((c) => c.type === 'number').slice(0, 4);

  const data = useMemo(() => {
    return (result.rows as ReportRow[]).map((row) => {
      const point: Record<string, string | number> = {
        label: formatCellPlain(row[labelKey], 'text'),
      };
      for (const col of numericCols) {
        point[col.key] = asNumber(row[col.key]) ?? 0;
      }
      return point;
    });
  }, [labelKey, numericCols, result.rows]);

  const table = {
    columns: numericCols.map((c) => ({ key: c.key, label: c.header })),
    rows: data.map((row) => ({
      label: String(row.label),
      values: Object.fromEntries(numericCols.map((c) => [c.key, row[c.key] ?? '—'])),
    })),
  };

  if (numericCols.length === 0 || data.length === 0) {
    return <p className="t-body text-text-secondary">{t('web.reports.noChartData')}</p>;
  }

  const moneyAxis = numericCols.some((c) => isMoneyColumn(c.key));
  const Chart = result.key === 'profit-loss' ? LineChart : BarChart;

  return (
    <div data-slot="report-chart">
    <ChartContainer title={title} table={table} height={320}>
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="var(--color-divider)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
          <YAxis
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
            tickFormatter={(v: number) =>
              moneyAxis ? formatMoney(v, locale, 'EGP').replace(/[^\d.,\-]/g, '').slice(0, 8) : String(v)
            }
            width={56}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
            }}
            formatter={(value, name) => {
              const n = typeof value === 'number' ? value : Number(value);
              const col = numericCols.find((c) => c.key === name);
              if (col && isMoneyColumn(col.key) && Number.isFinite(n)) {
                return [formatMoney(n, locale, 'EGP'), col.header];
              }
              return [value, col?.header ?? String(name)];
            }}
          />
          <Legend />
          {result.key === 'profit-loss'
            ? numericCols.map((col, i) => (
                <Line
                  key={col.key}
                  type="monotone"
                  dataKey={col.key}
                  name={col.header}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))
            : numericCols.map((col, i) => (
                <Bar
                  key={col.key}
                  dataKey={col.key}
                  name={col.header}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
        </Chart>
      </ResponsiveContainer>
    </ChartContainer>
    </div>
  );
}
