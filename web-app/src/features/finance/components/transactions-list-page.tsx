'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
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
  DateRangeFilter,
  FilterBar,
  LookupFilter,
  SearchFilter,
  SelectFilter,
} from '@/components/filter-bar/filter-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { useUrlFilters } from '@/lib/query/hooks';
import { cn } from '@/lib/utils';

import { useExportTransactionsMutation, useTransactionsList } from '../hooks';
import { downloadBlob } from '../lib/value';
import {
  type FinanceTransaction,
  TRANSACTION_SORTABLE,
  TRANSACTION_SOURCES,
  type TransactionSource,
} from '../model';

const filtersSchema = z.object({
  search: z.string().optional(),
  kind: z.enum(['EXPENSE', 'INCOME']).optional(),
  categoryId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  source: z.union([z.string(), z.array(z.string())]).optional(),
  paymentMethodId: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  branchId: z.string().optional(),
  includeVoided: z.union([z.boolean(), z.string()]).optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

const defaults = {
  page: 1,
  limit: 20,
  sortBy: 'transactionDate',
  sortDir: 'desc' as const,
};

function normalizeList(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

export function TransactionsListPage() {
  const t = useTranslations();
  const { permissions } = useSession();
  const [filters, setFilters, reset] = useUrlFilters(filtersSchema, defaults);
  const exportMutation = useExportTransactionsMutation();
  const [exporting, setExporting] = useState(false);

  const includeVoided =
    filters.includeVoided === true || filters.includeVoided === 'true';

  const listParams = useMemo(
    () => ({
      page: filters.page,
      limit: filters.limit,
      sortBy: (filters.sortBy as 'transactionDate' | 'amount' | 'createdAt' | undefined) ??
        'transactionDate',
      sortDir: filters.sortDir,
      search: filters.search,
      kind: filters.kind,
      categoryId: filters.categoryId,
      includeSubcategories: filters.categoryId ? true : undefined,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      source: normalizeList(filters.source) as TransactionSource[] | undefined,
      paymentMethodId: filters.paymentMethodId,
      minAmount: filters.minAmount,
      maxAmount: filters.maxAmount,
      branchId: can(permissions, P.financeReadAll) ? filters.branchId : undefined,
      includeVoided: includeVoided || undefined,
    }),
    [filters, includeVoided, permissions],
  );

  const query = useTransactionsList(listParams);

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.kind ||
      filters.categoryId ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.source ||
      filters.paymentMethodId ||
      filters.minAmount != null ||
      filters.maxAmount != null ||
      filters.branchId ||
      includeVoided,
  );

  const kindOptions = useMemo(
    () => [
      { value: 'EXPENSE', label: t('shared.finance_expense') },
      { value: 'INCOME', label: t('shared.finance_income') },
    ],
    [t],
  );

  const sourceOptions = useMemo(
    () =>
      TRANSACTION_SOURCES.map((value) => ({
        value,
        label: t(`web.finance.source.${value}` as 'web.finance.source.MANUAL'),
      })),
    [t],
  );

  const columns = useMemo<DataTableColumn<FinanceTransaction>[]>(
    () => [
      {
        id: 'transactionDate',
        accessorKey: 'transactionDate',
        header: t('shared.finance_date'),
        meta: { label: t('shared.finance_date'), locked: true },
        cell: ({ row }) => <DateText value={row.original.transactionDate} />,
      },
      {
        id: 'category',
        enableSorting: false,
        header: t('shared.finance_category'),
        meta: { label: t('shared.finance_category') },
        cell: ({ row }) => (
          <span className="line-clamp-2">{row.original.category.path || row.original.category.name}</span>
        ),
      },
      {
        id: 'kind',
        enableSorting: false,
        header: t('shared.finance_kind'),
        meta: { label: t('shared.finance_kind') },
        cell: ({ row }) => (
          <StatusChip
            status={row.original.kind}
            tone={row.original.kind === 'INCOME' ? 'success' : 'danger'}
            label={
              row.original.kind === 'INCOME'
                ? t('shared.finance_income')
                : t('shared.finance_expense')
            }
          />
        ),
      },
      {
        id: 'amount',
        accessorKey: 'amount',
        header: t('shared.finance_amount'),
        meta: { label: t('shared.finance_amount') },
        cell: ({ row }) => (
          <Money
            value={row.original.kind === 'EXPENSE' ? -row.original.amount : row.original.amount}
            className={cn(
              row.original.isVoided && 'line-through opacity-60',
              row.original.kind === 'INCOME' ? 'text-success' : 'text-danger',
            )}
          />
        ),
      },
      {
        id: 'paymentMethod',
        enableSorting: false,
        header: t('shared.finance_payment_method'),
        meta: { label: t('shared.finance_payment_method') },
        cell: ({ row }) => row.original.paymentMethod.name,
      },
      {
        id: 'source',
        enableSorting: false,
        header: t('shared.finance_source'),
        meta: { label: t('shared.finance_source') },
        cell: ({ row }) => (
          <StatusChip
            status={row.original.source}
            tone={row.original.source === 'MANUAL' ? 'neutral' : 'info'}
            label={t(`web.finance.source.${row.original.source}` as 'web.finance.source.MANUAL')}
          />
        ),
      },
      {
        id: 'reference',
        enableSorting: false,
        header: t('web.finance.reference'),
        meta: { label: t('web.finance.reference') },
        cell: ({ row }) => <span className="t-mono">{row.original.referenceNo}</span>,
      },
      {
        id: 'voided',
        enableSorting: false,
        header: t('shared.finance_voided'),
        meta: { label: t('shared.finance_voided') },
        cell: ({ row }) =>
          row.original.isVoided ? (
            <StatusChip status="VOIDED" tone="neutral" label={t('shared.finance_voided')} />
          ) : (
            '—'
          ),
      },
    ],
    [t],
  );

  const rows = query.data?.data ?? [];
  const pageTotal = rows.reduce((sum, row) => {
    if (row.isVoided) return sum;
    return sum + (row.kind === 'INCOME' ? row.amount : -row.amount);
  }, 0);

  const exportView = async () => {
    setExporting(true);
    try {
      const result = await exportMutation.mutateAsync({ ...listParams, format: 'csv' });
      downloadBlob(result.filename, result.blob);
      toast.success(t('web.finance.exportDone'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('web.errors.generic'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('shared.finance_transactions')}
        subtitle={t('web.finance.transactionsSubtitle')}
        actions={
          <>
            <Can perm={P.reportsExport}>
              <Button
                type="button"
                variant="outline"
                disabled={exporting || exportMutation.isPending}
                onClick={() => void exportView()}
              >
                {t('web.finance.export')}
              </Button>
            </Can>
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

      <FilterBar
        state={filters}
        onChange={setFilters}
        onReset={reset}
        storageKey="finance.transactions"
      >
        <SearchFilter name="search" placeholder={t('shared.finance_reference_or_notes')} dir="auto" />
        <SelectFilter name="kind" label={t('shared.finance_kind')} options={kindOptions} />
        <LookupFilter
          name="categoryId"
          label={t('shared.finance_category')}
          endpoint={endpoints.finance.categories}
        />
        <DateRangeFilter from="dateFrom" to="dateTo" label={t('shared.finance_date_range')} />
        <SelectFilter
          name="source"
          label={t('shared.finance_source')}
          options={sourceOptions}
          multiple
        />
        <LookupFilter
          name="paymentMethodId"
          label={t('shared.finance_payment_method')}
          endpoint={endpoints.lookups.paymentMethods}
        />
        <div className="min-w-[120px] space-y-xs">
          <label className="t-caption text-text-secondary" htmlFor="filter-minAmount">
            {t('shared.finance_min_amount')}
          </label>
          <Input
            id="filter-minAmount"
            type="number"
            dir="ltr"
            className="t-mono"
            value={filters.minAmount ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setFilters({ minAmount: v === '' ? undefined : Number(v) });
            }}
          />
        </div>
        <div className="min-w-[120px] space-y-xs">
          <label className="t-caption text-text-secondary" htmlFor="filter-maxAmount">
            {t('shared.finance_max_amount')}
          </label>
          <Input
            id="filter-maxAmount"
            type="number"
            dir="ltr"
            className="t-mono"
            value={filters.maxAmount ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setFilters({ maxAmount: v === '' ? undefined : Number(v) });
            }}
          />
        </div>
        <Can perm={P.financeReadAll}>
          <BranchFilter name="branchId" readAllPerm={P.financeReadAll} />
        </Can>
        <BooleanFilter name="includeVoided" label={t('shared.finance_include_voided')} />
      </FilterBar>

      <DataTable
        columns={columns}
        data={rows}
        meta={query.data?.meta}
        state={{
          page: filters.page,
          limit: filters.limit,
          sortBy: filters.sortBy,
          sortDir: filters.sortDir,
        }}
        onStateChange={(patch) => setFilters(patch)}
        sortableColumns={TRANSACTION_SORTABLE}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowHref={(row) => `/finance/transactions/${row.id}`}
        emptyState={
          hasActiveFilters ? (
            <FilteredEmptyState onClear={reset} />
          ) : (
            <EmptyState
              title={t('shared.finance_no_transactions')}
              description={t('shared.finance_no_transactions_subtitle')}
            />
          )
        }
        sticky={{ header: true, firstColumn: true }}
        getRowId={(row) => row.id}
      />

      <div className="flex flex-wrap items-center justify-between gap-sm rounded-md border border-border bg-surface px-md py-sm">
        <p className="t-caption text-text-secondary">{t('web.finance.pageTotalHint')}</p>
        <Money value={pageTotal} className="t-h3" />
      </div>
    </div>
  );
}
