'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { z } from 'zod';

import { CHART_COLORS,ChartContainer } from '@/components/charts/chart-container';
import { Can } from '@/components/common/can';
import { Money } from '@/components/common/money';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { BranchFilter, DateRangeFilter, FilterBar, SelectFilter } from '@/components/filter-bar/filter-bar';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { useUrlFilters } from '@/lib/query/hooks';
import { BUDGET_TONE } from '@/lib/theme/status-tone';
import { cn } from '@/lib/utils';

import {
  useBudgetsStatus,
  useFinanceByCategory,
  useFinanceSummary,
  useTransactionsList,
} from '../hooks';
import { type FinancePeriodPreset,resolvePeriodRange } from '../lib/period';
import { asNumber, asText } from '../lib/value';
import { BudgetProgress } from './budget-progress';

const filtersSchema = z.object({
  period: z.enum(['thisMonth', 'lastMonth', 'quarter', 'year', 'custom']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  branchId: z.string().optional(),
  kind: z.enum(['EXPENSE', 'INCOME']).optional(),
  rootCategoryId: z.string().optional(),
});

const defaults = {
  period: 'thisMonth' as FinancePeriodPreset,
};

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="t-caption text-text-secondary">—</span>;
  const positive = value >= 0;
  return (
    <span
      dir="ltr"
      className={cn('t-caption t-mono', positive ? 'text-success' : 'text-danger')}
    >
      {positive ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}

export function FinanceOverviewPage() {
  const t = useTranslations();
  const { permissions } = useSession();
  const [filters, setFilters, reset] = useUrlFilters(filtersSchema, defaults);

  const period = (filters.period ?? 'thisMonth') as FinancePeriodPreset;
  const range = useMemo(
    () => resolvePeriodRange(period, filters.dateFrom, filters.dateTo),
    [period, filters.dateFrom, filters.dateTo],
  );

  const summaryParams = useMemo(
    () => ({
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      branchId: filters.branchId,
      compareToPrevious: true,
    }),
    [range, filters.branchId],
  );

  const byCategoryParams = useMemo(
    () => ({
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      branchId: filters.branchId,
      kind: filters.kind,
      rootCategoryId: filters.rootCategoryId,
      maxDepth: 2,
    }),
    [range, filters.branchId, filters.kind, filters.rootCategoryId],
  );

  const summary = useFinanceSummary(summaryParams);
  const byCategory = useFinanceByCategory(byCategoryParams);
  const budgets = useBudgetsStatus(
    { branchId: filters.branchId, limit: 8 },
    can(permissions, P.financeBudgetsManage) || can(permissions, P.financeRead),
  );
  const recent = useTransactionsList({
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    branchId: filters.branchId,
    page: 1,
    limit: 8,
    sortBy: 'transactionDate',
    sortDir: 'desc',
  });

  const periodOptions = useMemo(
    () =>
      (
        [
          ['thisMonth', t('web.finance.periodThisMonth')],
          ['lastMonth', t('web.finance.periodLastMonth')],
          ['quarter', t('web.finance.periodQuarter')],
          ['year', t('web.finance.periodYear')],
          ['custom', t('web.finance.periodCustom')],
        ] as const
      ).map(([value, label]) => ({ value, label })),
    [t],
  );

  const kindOptions = useMemo(
    () => [
      { value: 'EXPENSE', label: t('shared.finance_expense') },
      { value: 'INCOME', label: t('shared.finance_income') },
    ],
    [t],
  );

  const paymentChart = useMemo(() => {
    const rows = summary.data?.byPaymentMethod ?? [];
    return rows.map((row) => ({
      name: row.name,
      income: row.income,
      expense: row.expense,
    }));
  }, [summary.data]);

  const categoryChart = useMemo(() => {
    const nodes = byCategory.data?.categories ?? [];
    return nodes.slice(0, 12).map((node) => ({
      name: node.name,
      total: node.rolledUpTotal,
    }));
  }, [byCategory.data]);

  const incomeDelta = asNumber(summary.data?.comparison?.incomeChangePercent);
  const expenseDelta = asNumber(summary.data?.comparison?.expenseChangePercent);
  const netDelta = asNumber(summary.data?.comparison?.netChangePercent);

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('shared.finance_title')}
        subtitle={t('web.finance.overviewSubtitle')}
        actions={
          <>
            <Link
              href="/finance/transactions"
              className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-2.5 t-body hover:bg-surface-alt"
            >
              {t('shared.finance_transactions')}
            </Link>
            <Can perm={P.financeCreate}>
              <Link
                href="/finance/transactions/new"
                className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 t-body text-primary-foreground hover:bg-primary/80"
              >
                {t('shared.finance_add_transaction')}
              </Link>
            </Can>
          </>
        }
      />

      <FilterBar state={filters} onChange={setFilters} onReset={reset} storageKey="finance.overview">
        <SelectFilter name="period" label={t('shared.finance_period')} options={periodOptions} />
        {period === 'custom' ? (
          <DateRangeFilter from="dateFrom" to="dateTo" label={t('shared.finance_date_range')} />
        ) : null}
        <Can perm={P.financeReadAll}>
          <BranchFilter name="branchId" readAllPerm={P.financeReadAll} />
        </Can>
        <SelectFilter name="kind" label={t('shared.finance_kind')} options={kindOptions} />
      </FilterBar>

      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <div className="grid gap-md md:grid-cols-3">
          <article className="rounded-md border border-border bg-surface p-md">
            <p className="t-caption text-text-secondary">{t('shared.finance_income')}</p>
            <p className="mt-xs flex items-baseline gap-sm">
              <Money value={summary.data?.income.total} className="t-h2 text-success" />
              <Delta value={incomeDelta} />
            </p>
            <p className="t-caption text-text-secondary">
              {t('web.finance.count', { count: summary.data?.income.count ?? 0 })}
            </p>
          </article>
          <article className="rounded-md border border-border bg-surface p-md">
            <p className="t-caption text-text-secondary">{t('shared.finance_expense')}</p>
            <p className="mt-xs flex items-baseline gap-sm">
              <Money value={summary.data?.expense.total} className="t-h2 text-danger" />
              <Delta value={expenseDelta} />
            </p>
            <p className="t-caption text-text-secondary">
              {t('web.finance.count', { count: summary.data?.expense.count ?? 0 })}
            </p>
          </article>
          <article className="rounded-md border border-border bg-surface p-md">
            <p className="t-caption text-text-secondary">{t('shared.finance_net')}</p>
            <p className="mt-xs flex items-baseline gap-sm">
              <Money
                value={summary.data?.net}
                className={cn(
                  't-h2',
                  (summary.data?.net ?? 0) >= 0 ? 'text-success' : 'text-danger',
                )}
              />
              <Delta value={netDelta} />
            </p>
            <p className="t-caption text-text-secondary" dir="ltr">
              {range.dateFrom} → {range.dateTo}
            </p>
          </article>
        </div>
      )}

      <div className="grid gap-md xl:grid-cols-2">
        <ChartContainer
          title={t('web.finance.byPaymentMethod')}
          loading={summary.isLoading}
          table={{
            columns: [
              { key: 'income', label: t('shared.finance_income') },
              { key: 'expense', label: t('shared.finance_expense') },
            ],
            rows: paymentChart.map((row) => ({
              label: row.name,
              values: { income: row.income, expense: row.expense },
            })),
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={paymentChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="income" name={t('shared.finance_income')} fill={CHART_COLORS[3]} stackId="a" />
              <Bar dataKey="expense" name={t('shared.finance_expense')} fill={CHART_COLORS[5]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer
          title={t('shared.finance_breakdown')}
          loading={byCategory.isLoading}
          table={{
            columns: [{ key: 'total', label: t('shared.finance_grand_total') }],
            rows: categoryChart.map((row) => ({
              label: row.name,
              values: { total: row.total },
            })),
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryChart} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider)" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar
                dataKey="total"
                name={t('shared.finance_grand_total')}
                fill={CHART_COLORS[0]}
                onClick={(data) => {
                  const id = (byCategory.data?.categories ?? []).find(
                    (c) => c.name === (data as { name?: string }).name,
                  )?.id;
                  if (id) setFilters({ rootCategoryId: id });
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      <section className="space-y-sm">
        <div className="flex items-center justify-between gap-sm">
          <h2 className="t-h3">{t('shared.finance_budget_alerts')}</h2>
          <Can perm={P.financeBudgetsManage}>
            <Link href="/finance/budgets" className="t-caption text-primary">
              {t('web.dashboard.viewAll')}
            </Link>
          </Can>
        </div>
        {budgets.isError ? (
          <ErrorState error={budgets.error} onRetry={() => void budgets.refetch()} />
        ) : (budgets.data ?? []).length === 0 ? (
          <EmptyState
            title={t('shared.finance_no_budgets')}
            description={t('shared.finance_no_budgets_subtitle')}
          />
        ) : (
          <div className="grid gap-md md:grid-cols-2 xl:grid-cols-3">
            {(budgets.data ?? [])
              .filter((b) => b.status !== 'OK')
              .concat((budgets.data ?? []).filter((b) => b.status === 'OK'))
              .slice(0, 6)
              .map((row) => (
                <article key={row.id} className="rounded-md border border-border bg-surface p-md">
                  <Link href={`/finance/budgets/${row.id}`} className="t-body font-medium hover:underline">
                    {row.category.path || row.category.name}
                  </Link>
                  <p className="t-caption text-text-secondary">
                    {t(`enums.budgetPeriod.${row.period.type}` as 'enums.budgetPeriod.MONTHLY')}
                  </p>
                  <BudgetProgress
                    className="mt-sm"
                    status={row}
                    statusLabel={t(`enums.budgetStatus.${row.status}` as 'enums.budgetStatus.OK')}
                  />
                  <span className="sr-only">{BUDGET_TONE[row.status]}</span>
                </article>
              ))}
          </div>
        )}
      </section>

      <section className="space-y-sm">
        <div className="flex items-center justify-between gap-sm">
          <h2 className="t-h3">{t('web.finance.recentTransactions')}</h2>
          <Link href="/finance/transactions" className="t-caption text-primary">
            {t('web.dashboard.viewAll')}
          </Link>
        </div>
        {recent.isError ? (
          <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
        ) : (recent.data?.data ?? []).length === 0 ? (
          <EmptyState
            title={t('shared.finance_no_transactions')}
            description={t('shared.finance_no_transactions_subtitle')}
          />
        ) : (
          <ul className="divide-y divide-divider rounded-md border border-border bg-surface">
            {(recent.data?.data ?? []).map((tx) => (
              <li key={tx.id}>
                <Link
                  href={`/finance/transactions/${tx.id}`}
                  className="flex flex-wrap items-center justify-between gap-sm px-md py-sm hover:bg-surface-alt"
                >
                  <div className="min-w-0">
                    <p className="t-body truncate">{tx.category.path || tx.category.name}</p>
                    <p className="t-caption text-text-secondary" dir="ltr">
                      {tx.transactionDate}
                      {tx.isVoided ? ` · ${t('shared.finance_voided')}` : ''}
                    </p>
                  </div>
                  <Money
                    value={tx.kind === 'EXPENSE' ? -tx.amount : tx.amount}
                    className={tx.kind === 'INCOME' ? 'text-success' : 'text-danger'}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {filters.rootCategoryId ? (
        <p className="t-caption text-text-secondary">
          {t('web.finance.drilledCategory')}: {asText(filters.rootCategoryId)}
        </p>
      ) : null}
    </div>
  );
}
