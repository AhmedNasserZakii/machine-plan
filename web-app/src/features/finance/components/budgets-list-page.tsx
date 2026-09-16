'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { z } from 'zod';

import { Can } from '@/components/common/can';
import { DateText } from '@/components/common/date-text';
import { Money } from '@/components/common/money';
import { StatusChip } from '@/components/common/status-chip';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState, FilteredEmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/feedback/page-header';
import {
  BooleanFilter,
  BranchFilter,
  FilterBar,
  LookupFilter,
} from '@/components/filter-bar/filter-bar';
import { Link } from '@/i18n/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { P } from '@/lib/auth/permissions';
import { useUrlFilters } from '@/lib/query/hooks';
import { BUDGET_TONE } from '@/lib/theme/status-tone';

import { useBudgetsList, useBudgetsStatus } from '../hooks';
import type { Budget, BudgetStatus } from '../model';

const filtersSchema = z.object({
  categoryId: z.string().optional(),
  branchId: z.string().optional(),
  activeOn: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

const defaults = {
  page: 1,
  limit: 20,
  sortDir: 'desc' as const,
};

export function BudgetsListPage() {
  const t = useTranslations();
  const [filters, setFilters, reset] = useUrlFilters(filtersSchema, defaults);

  const includeInactive =
    filters.includeInactive === true || filters.includeInactive === 'true';

  const listParams = useMemo(
    () => ({
      page: filters.page,
      limit: filters.limit,
      sortDir: filters.sortDir,
      categoryId: filters.categoryId,
      branchId: filters.branchId,
      activeOn: filters.activeOn,
      includeInactive: includeInactive || undefined,
    }),
    [filters, includeInactive],
  );

  const query = useBudgetsList(listParams);
  const statusQuery = useBudgetsStatus({
    branchId: filters.branchId,
    limit: 100,
  });

  const statusById = useMemo(() => {
    const map = new Map<string, BudgetStatus>();
    for (const row of statusQuery.data ?? []) map.set(row.id, row);
    return map;
  }, [statusQuery.data]);

  const hasActiveFilters = Boolean(
    filters.categoryId || filters.branchId || filters.activeOn || includeInactive,
  );

  const columns = useMemo<DataTableColumn<Budget>[]>(
    () => [
      {
        id: 'category',
        enableSorting: false,
        header: t('shared.finance_category'),
        meta: { label: t('shared.finance_category'), locked: true },
        cell: ({ row }) => row.original.category.path || row.original.category.name,
      },
      {
        id: 'period',
        enableSorting: false,
        header: t('shared.finance_period'),
        meta: { label: t('shared.finance_period') },
        cell: ({ row }) => (
          <span>
            {t(`enums.budgetPeriod.${row.original.periodType}` as 'enums.budgetPeriod.MONTHLY')}
            <span className="ms-xs t-caption text-text-secondary" dir="ltr">
              <DateText value={row.original.periodStart} />
              {' → '}
              <DateText value={row.original.periodEnd} />
            </span>
          </span>
        ),
      },
      {
        id: 'amount',
        enableSorting: false,
        header: t('shared.finance_budget_amount'),
        meta: { label: t('shared.finance_budget_amount') },
        cell: ({ row }) => <Money value={row.original.amount} />,
      },
      {
        id: 'progress',
        enableSorting: false,
        header: t('web.finance.progress'),
        meta: { label: t('web.finance.progress') },
        cell: ({ row }) => {
          const status = statusById.get(row.original.id);
          if (!status) return '—';
          const tone = BUDGET_TONE[status.status] ?? 'neutral';
          const pct = Math.min(100, Math.max(0, status.usedPercent));
          return (
            <div className="min-w-[140px] space-y-xs">
              <StatusChip
                status={status.status}
                tone={tone}
                label={t(`enums.budgetStatus.${status.status}` as 'enums.budgetStatus.OK')}
              />
              <div className="h-1.5 overflow-hidden rounded-sm bg-neutral-surface">
                <div
                  className={
                    tone === 'danger'
                      ? 'h-full bg-danger'
                      : tone === 'warning'
                        ? 'h-full bg-warning'
                        : 'h-full bg-success'
                  }
                  style={{ inlineSize: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between t-caption">
                <Money value={status.spent} />
                <Money value={status.remaining} />
              </div>
            </div>
          );
        },
      },
      {
        id: 'threshold',
        enableSorting: false,
        header: t('shared.finance_warning_threshold'),
        meta: { label: t('shared.finance_warning_threshold') },
        cell: ({ row }) => (
          <span className="t-mono" dir="ltr">
            {row.original.alertThresholdPercent}%
          </span>
        ),
      },
    ],
    [statusById, t],
  );

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('shared.finance_budgets')}
        subtitle={t('web.finance.budgetsSubtitle')}
        actions={
          <Can perm={P.financeBudgetsManage}>
            <Link
              href="/finance/budgets/new"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 t-body text-primary-foreground hover:bg-primary/80"
            >
              {t('shared.finance_add_budget')}
            </Link>
          </Can>
        }
      />

      <FilterBar state={filters} onChange={setFilters} onReset={reset} storageKey="finance.budgets">
        <LookupFilter
          name="categoryId"
          label={t('shared.finance_expense_category')}
          endpoint={endpoints.finance.categories}
        />
        <Can perm={P.financeReadAll}>
          <BranchFilter name="branchId" readAllPerm={P.financeReadAll} />
        </Can>
        <BooleanFilter name="includeInactive" label={t('web.finance.includeInactive')} />
      </FilterBar>

      <DataTable
        columns={columns}
        data={query.data?.data ?? []}
        meta={query.data?.meta}
        state={{
          page: filters.page,
          limit: filters.limit,
          sortDir: filters.sortDir,
        }}
        onStateChange={(patch) => setFilters(patch)}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowHref={(row) => `/finance/budgets/${row.id}`}
        emptyState={
          hasActiveFilters ? (
            <FilteredEmptyState onClear={reset} />
          ) : (
            <EmptyState
              title={t('shared.finance_no_budgets')}
              description={t('shared.finance_no_budgets_subtitle')}
            />
          )
        }
        getRowId={(row) => row.id}
      />
    </div>
  );
}
