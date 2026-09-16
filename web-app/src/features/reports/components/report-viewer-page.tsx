'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import { z } from 'zod';

import { DateText } from '@/components/common/date-text';
import { Money } from '@/components/common/money';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { NoAccess } from '@/components/feedback/no-access';
import { PageHeader } from '@/components/feedback/page-header';
import { TableSkeleton } from '@/components/feedback/table-skeleton';
import {
  BranchFilter,
  DateRangeFilter,
  FilterBar,
  LookupFilter,
  SelectFilter,
} from '@/components/filter-bar/filter-bar';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { useUrlFilters } from '@/lib/query/hooks';
import { cn } from '@/lib/utils';

import { useReportQuery } from '../hooks';
import { asNumber, isMoneyColumn } from '../lib/cell';
import { markLastRun } from '../lib/pinning';
import { configBySlug, type ReportConfig, type ReportQueryParams } from '../model';
import { ReportChart } from './report-chart';
import { ReportExportMenu } from './report-export-menu';
import { ReportTable } from './report-table';

const filtersSchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  branchId: z.string().optional(),
  groupBy: z.string().optional(),
  days: z.string().optional(),
  granularity: z.enum(['day', 'week', 'month', 'year']).optional(),
  machineId: z.string().optional(),
  compare: z.enum(['1']).optional(),
  compareFrom: z.string().optional(),
  compareTo: z.string().optional(),
});

const defaults = {
  page: 1,
  limit: 50,
  sortDir: 'desc' as const,
};

function shiftRangeBack(
  dateFrom?: string,
  dateTo?: string,
): { dateFrom?: string; dateTo?: string } {
  if (!dateFrom || !dateTo) return {};
  const from = new Date(`${dateFrom}T00:00:00.000Z`);
  const to = new Date(`${dateTo}T00:00:00.000Z`);
  const ms = to.getTime() - from.getTime() + 86_400_000;
  const prevTo = new Date(from.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - ms + 86_400_000);
  return {
    dateFrom: prevFrom.toISOString().slice(0, 10),
    dateTo: prevTo.toISOString().slice(0, 10),
  };
}

type ReportViewerPageProps = {
  slug: string;
};

export function ReportViewerPage({ slug }: ReportViewerPageProps) {
  const t = useTranslations();
  const { permissions } = useSession();
  const config = configBySlug(slug);
  const [filters, setFilters, reset] = useUrlFilters(filtersSchema, defaults);

  const queryParams: ReportQueryParams = useMemo(
    () => ({
      page: filters.page ?? 1,
      limit: filters.limit ?? 50,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      branchId: filters.branchId,
      groupBy: filters.groupBy,
      days: filters.days ? Number(filters.days) : undefined,
      granularity: filters.granularity,
      machineId: filters.machineId,
    }),
    [filters],
  );

  const compareEnabled = Boolean(config?.comparison && filters.compare === '1');
  const compareRange = useMemo(() => {
    if (!compareEnabled) return null;
    if (filters.compareFrom && filters.compareTo) {
      return { dateFrom: filters.compareFrom, dateTo: filters.compareTo };
    }
    return shiftRangeBack(filters.dateFrom, filters.dateTo);
  }, [compareEnabled, filters.compareFrom, filters.compareTo, filters.dateFrom, filters.dateTo]);

  const compareParams: ReportQueryParams = useMemo(
    () => ({
      ...queryParams,
      dateFrom: compareRange?.dateFrom,
      dateTo: compareRange?.dateTo,
    }),
    [compareRange, queryParams],
  );

  const query = useReportQuery(config, queryParams);
  const compareQuery = useReportQuery(config, compareParams, compareEnabled && Boolean(compareRange?.dateFrom));

  useEffect(() => {
    if (query.isSuccess && config) markLastRun(config.slug);
  }, [query.isSuccess, config]);

  if (!config) {
    return (
      <EmptyState title={t('web.reports.unknownTitle')} description={t('web.reports.unknownBody')} />
    );
  }

  if (!can(permissions, config.permission)) {
    return <NoAccess />;
  }

  const result = query.data;
  const groupColumn =
    config.groupBy && filters.groupBy
      ? 'group'
      : undefined;

  const totalsEntries = result ? Object.entries(result.totals ?? {}) : [];
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const rowCount = result?.rowCount ?? 0;
  const hasNext = page * limit < rowCount;
  const hasPrev = page > 1;

  return (
    <div className="space-y-md report-print">
      <div className="print-only space-y-xs border-b border-border pb-md">
        <h1 className="t-h1">{result?.title ?? t(config.descriptionKey)}</h1>
        <p className="t-caption text-text-secondary">
          {t('web.reports.printedAt')}{' '}
          <DateText value={result?.generatedAt ?? new Date().toISOString()} format="datetime" />
        </p>
        <ActiveFilterSummary config={config} filters={filters} />
      </div>

      <PageHeader
        title={result?.title ?? t(config.descriptionKey)}
        subtitle={t(config.descriptionKey)}
        breadcrumbs={
          <nav className="t-caption text-text-secondary" aria-label={t('web.common.breadcrumbs')}>
            <Link href="/reports" className="hover:underline">
              {t('shared.reports')}
            </Link>
            <span aria-hidden> / </span>
            <span>{result?.title ?? slug}</span>
          </nav>
        }
        actions={
          <div className="no-print flex flex-wrap items-center gap-sm">
            {config.comparison ? (
              <Button
                type="button"
                variant={compareEnabled ? 'default' : 'outline'}
                onClick={() => {
                  if (compareEnabled) {
                    setFilters({
                      compare: undefined,
                      compareFrom: undefined,
                      compareTo: undefined,
                    });
                    return;
                  }
                  const prev = shiftRangeBack(filters.dateFrom, filters.dateTo);
                  setFilters({
                    compare: '1',
                    compareFrom: prev.dateFrom,
                    compareTo: prev.dateTo,
                  });
                }}
              >
                {t('web.reports.comparison')}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => window.print()}>
              {t('web.reports.print')}
            </Button>
            <ReportExportMenu config={config} params={queryParams} />
          </div>
        }
      />

      <div data-slot="filter-bar" className="no-print">
        <FilterBar
          state={filters as Record<string, unknown>}
          onChange={(patch) => setFilters(patch)}
          onReset={reset}
          storageKey={`reports.${config.slug}.views`}
        >
          {config.filters.map((def) => {
            if (def.type === 'dateRange') {
              return (
                <DateRangeFilter
                  key="dateRange"
                  from="dateFrom"
                  to="dateTo"
                  label={t('web.reports.dateRange')}
                />
              );
            }
            if (def.type === 'branch') {
              return (
                <BranchFilter
                  key="branch"
                  readAllPerm={
                    config.domain === 'finance'
                      ? P.financeReadAll
                      : config.domain === 'transfers'
                        ? P.transfersReadAll
                        : config.domain === 'merchants'
                          ? P.merchantsReadAll
                          : config.domain === 'people'
                            ? P.violationsReadAll
                            : P.machinesReadAll
                  }
                />
              );
            }
            if (def.type === 'groupBy') {
              return (
                <SelectFilter
                  key="groupBy"
                  name="groupBy"
                  label={t('web.reports.groupBy')}
                  options={def.options.map((value) => ({
                    value,
                    label: t(`web.reports.groupByOptions.${value}`),
                  }))}
                />
              );
            }
            if (def.type === 'days') {
              return (
                <SelectFilter
                  key="days"
                  name="days"
                  label={t('web.reports.days')}
                  options={[7, 14, 30, 60, 90, 180].map((d) => ({
                    value: String(d),
                    label: t('web.reports.daysOption', { count: d }),
                  }))}
                />
              );
            }
            if (def.type === 'granularity') {
              return (
                <SelectFilter
                  key="granularity"
                  name="granularity"
                  label={t('web.reports.granularity')}
                  options={['day', 'week', 'month', 'year'].map((value) => ({
                    value,
                    label: t(`web.reports.granularityOptions.${value}`),
                  }))}
                />
              );
            }
            if (def.type === 'machineId') {
              return (
                <LookupFilter
                  key="machineId"
                  name="machineId"
                  label={t('web.reports.machine')}
                  endpoint={endpoints.machines.list}
                  mapOption={(item) => ({
                    value: String(item.id ?? ''),
                    label: String(item.serial ?? item.id ?? ''),
                  })}
                />
              );
            }
            return null;
          })}
          {compareEnabled ? (
            <DateRangeFilter
              key="compareRange"
              from="compareFrom"
              to="compareTo"
              label={t('web.reports.compareRange')}
            />
          ) : null}
        </FilterBar>
      </div>

      {config.key === 'machine-lifecycle' && !filters.machineId ? (
        <EmptyState
          title={t('web.reports.pickMachineTitle')}
          description={t('web.reports.pickMachineBody')}
        />
      ) : null}

      {query.isLoading ? <TableSkeleton rows={10} /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}

      {result ? (
        <div className="space-y-md">
          {totalsEntries.length > 0 ? (
            <div className="flex flex-wrap gap-md">
              {totalsEntries.map(([key, value]) => (
                <div key={key} className="min-w-[8rem] rounded-md border border-border bg-surface px-md py-sm">
                  <p className="t-caption text-text-secondary">{key}</p>
                  <p className="t-h3">
                    {typeof value === 'number' && isMoneyColumn(key) ? (
                      <Money value={asNumber(value)} />
                    ) : (
                      <span className={cn(typeof value === 'number' && 't-mono')} dir="ltr">
                        {String(value)}
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {compareEnabled ? (
            <p className="t-caption text-text-secondary no-print">
              {t('web.reports.comparingTo', {
                from: compareRange?.dateFrom ?? '—',
                to: compareRange?.dateTo ?? '—',
              })}
            </p>
          ) : null}

          {(config.view === 'chart' || config.view === 'split') && result.rows.length > 0 ? (
            <ReportChart result={result} title={result.title} />
          ) : null}

          {(config.view === 'table' || config.view === 'split') && result.rows.length > 0 ? (
            <ReportTable
              config={config}
              result={result}
              dateRange={{ dateFrom: filters.dateFrom, dateTo: filters.dateTo }}
              groupByColumn={groupColumn}
              compareResult={compareEnabled ? compareQuery.data : null}
            />
          ) : null}

          {result.rows.length === 0 ? (
            <EmptyState title={t('web.reports.emptyRows')} filtered />
          ) : null}

          {result.truncated ? (
            <p className="t-caption text-warning" role="status">
              {t('web.reports.truncated')}
            </p>
          ) : null}

          <footer className="flex flex-wrap items-center justify-between gap-md border-t border-divider pt-md">
            <div className="space-y-xs">
              <p className="t-caption text-text-secondary">
                {t('web.reports.rowCount', { count: rowCount })}
              </p>
              <p className="t-caption text-text-secondary">
                {t('web.reports.generatedAt')}{' '}
                <DateText value={result.generatedAt} format="datetime" />
              </p>
              <ActiveFilterSummary config={config} filters={filters} />
            </div>
            <div className="no-print flex items-center gap-sm">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setFilters({ page: page - 1 })}
              >
                {t('web.table.previousPage')}
              </Button>
              <span className="t-caption text-text-secondary">
                {t('web.table.page')} {page}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => setFilters({ page: page + 1 })}
              >
                {t('web.table.nextPage')}
              </Button>
            </div>
          </footer>
        </div>
      ) : null}
    </div>
  );
}

function ActiveFilterSummary({
  config,
  filters,
}: {
  config: ReportConfig;
  filters: z.infer<typeof filtersSchema>;
}) {
  const t = useTranslations();
  const parts: string[] = [];
  if (filters.dateFrom || filters.dateTo) {
    parts.push(`${filters.dateFrom ?? '…'} → ${filters.dateTo ?? '…'}`);
  }
  if (filters.branchId) parts.push(`${t('web.reports.branch')}: ${filters.branchId}`);
  if (filters.groupBy) parts.push(`${t('web.reports.groupBy')}: ${filters.groupBy}`);
  if (filters.days) parts.push(`${t('web.reports.days')}: ${filters.days}`);
  if (filters.granularity) parts.push(`${t('web.reports.granularity')}: ${filters.granularity}`);
  if (filters.machineId) parts.push(`${t('web.reports.machine')}: ${filters.machineId}`);
  if (parts.length === 0) return null;
  return (
    <p className="t-caption text-text-secondary">
      {t('web.reports.activeFilters')}: {parts.join(' · ')}
      <span className="sr-only"> ({config.slug})</span>
    </p>
  );
}
