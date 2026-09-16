'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { z } from 'zod';

import { Can } from '@/components/common/can';
import { DateText } from '@/components/common/date-text';
import { HolderChip } from '@/components/common/holder-chip';
import { StatusChip } from '@/components/common/status-chip';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/feedback/page-header';
import {
  BranchFilter,
  DateRangeFilter,
  FilterBar,
  SelectFilter,
} from '@/components/filter-bar/filter-bar';
import { Link } from '@/i18n/navigation';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { useUrlFilters } from '@/lib/query/hooks';
import { TRANSFER_STATUS_TONE } from '@/lib/theme/status-tone';
import { cn } from '@/lib/utils';

import { useCreatableTransferTypes, useTransfersList } from '../hooks/use-transfers';
import {
  isTransferStuck,
  partyName,
  type TransferListItem,
  type TransfersView,
} from '../model/types';

const filtersSchema = z.object({
  view: z.enum(['all', 'incoming', 'outgoing']).optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  type: z.union([z.string(), z.array(z.string())]).optional(),
  branchId: z.string().optional(),
  machineId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

const defaults = {
  view: 'all' as TransfersView,
  page: 1,
  limit: 20,
  sortDir: 'desc' as const,
};

function normalizeList(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

export function TransfersListPage() {
  const t = useTranslations();
  const { permissions, isLoading: sessionLoading } = useSession();
  const defaultView = useMemo<TransfersView>(
    () => (permissions.includes(P.transfersConfirm) ? 'incoming' : 'all'),
    [permissions],
  );
  const filterDefaults = useMemo(
    () => ({ ...defaults, view: defaultView }),
    [defaultView],
  );
  const [filters, setFilters, reset] = useUrlFilters(filtersSchema, filterDefaults);

  const view = (filters.view ?? defaultView) as TransfersView;
  const creatable = useCreatableTransferTypes(!sessionLoading);

  const listParams = useMemo(
    () => ({
      page: filters.page,
      limit: filters.limit,
      sortDir: filters.sortDir,
      status: normalizeList(filters.status),
      type: normalizeList(filters.type),
      branchId: filters.branchId,
      machineId: filters.machineId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }),
    [filters],
  );

  const query = useTransfersList(view, listParams);

  const hasActiveFilters = Boolean(
    filters.status ||
      filters.type ||
      filters.branchId ||
      filters.machineId ||
      filters.dateFrom ||
      filters.dateTo,
  );

  const typeOptions = useMemo(() => {
    const fromCreatable = (creatable.data ?? []).map((row) => row.type);
    const fromRows = (query.data?.data ?? []).map((row) => row.type);
    const all = [...new Set([...fromCreatable, ...fromRows])];
    return all.map((value) => ({
      value,
      label: t(`enums.transferType.${value}` as 'enums.transferType.UNKNOWN'),
    }));
  }, [creatable.data, query.data?.data, t]);

  const statusOptions = useMemo(
    () =>
      (['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'] as const).map((value) => ({
        value,
        label: t(`enums.transferStatus.${value}`),
      })),
    [t],
  );

  const columns = useMemo<DataTableColumn<TransferListItem>[]>(
    () => [
      {
        id: 'referenceNo',
        accessorKey: 'referenceNo',
        header: t('web.transfers.reference'),
        meta: { label: t('web.transfers.reference'), locked: true },
        cell: ({ row }) => <span className="t-mono">{row.original.referenceNo}</span>,
      },
      {
        id: 'type',
        accessorKey: 'type',
        enableSorting: false,
        header: t('web.transfers.type'),
        meta: { label: t('web.transfers.type') },
        cell: ({ row }) =>
          t(`enums.transferType.${row.original.type}` as 'enums.transferType.UNKNOWN'),
      },
      {
        id: 'status',
        accessorKey: 'status',
        enableSorting: false,
        header: t('web.transfers.status'),
        meta: { label: t('web.transfers.status') },
        cell: ({ row }) => {
          const status = row.original.status;
          const stuck = isTransferStuck(row.original.createdAt, status);
          return (
            <StatusChip
              status={status}
              tone={stuck ? 'danger' : (TRANSFER_STATUS_TONE[status] ?? 'neutral')}
              label={
                stuck
                  ? t('web.transfers.stuckPending')
                  : t(`enums.transferStatus.${status}` as 'enums.transferStatus.UNKNOWN')
              }
            />
          );
        },
      },
      {
        id: 'from',
        enableSorting: false,
        header: t('shared.transfer_from'),
        meta: { label: t('shared.transfer_from') },
        cell: ({ row }) => (
          <HolderChip type={row.original.from.type} name={partyName(row.original.from)} />
        ),
      },
      {
        id: 'to',
        enableSorting: false,
        header: t('shared.transfer_to'),
        meta: { label: t('shared.transfer_to') },
        cell: ({ row }) => (
          <HolderChip type={row.original.to.type} name={partyName(row.original.to)} />
        ),
      },
      {
        id: 'itemsCount',
        accessorKey: 'itemsCount',
        enableSorting: false,
        header: t('web.transfers.machines'),
        meta: { label: t('web.transfers.machines') },
        cell: ({ row }) => row.original.itemsCount,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        enableSorting: false,
        header: t('web.transfers.createdAt'),
        meta: { label: t('web.transfers.createdAt') },
        cell: ({ row }) => <DateText value={row.original.createdAt} format="datetime" />,
      },
      {
        id: 'age',
        enableSorting: false,
        header: t('web.transfers.age'),
        meta: { label: t('web.transfers.age') },
        cell: ({ row }) => {
          const stuck = isTransferStuck(row.original.createdAt, row.original.status);
          return (
            <DateText
              value={row.original.createdAt}
              format="relative"
              className={cn(stuck && 'font-medium text-danger')}
            />
          );
        },
      },
      {
        id: 'confirmedAt',
        enableSorting: false,
        header: t('shared.transfer_confirmed_at'),
        meta: { label: t('shared.transfer_confirmed_at') },
        cell: ({ row }) => {
          const value =
            typeof row.original.confirmedAt === 'string' ? row.original.confirmedAt : null;
          return <DateText value={value} format="datetime" />;
        },
      },
    ],
    [t],
  );

  const views: { id: TransfersView; label: string }[] = [
    { id: 'incoming', label: t('shared.transfers_tab_incoming') },
    { id: 'outgoing', label: t('shared.transfers_tab_outgoing') },
    { id: 'all', label: t('shared.transfers_tab_all') },
  ];

  const emptyTitle =
    view === 'incoming'
      ? t('shared.transfers_empty_incoming_title')
      : view === 'outgoing'
        ? t('shared.transfers_empty_outgoing_title')
        : t('shared.transfers_empty_all_title');
  const emptyBody =
    view === 'incoming'
      ? t('shared.transfers_empty_incoming_subtitle')
      : view === 'outgoing'
        ? t('shared.transfers_empty_outgoing_subtitle')
        : t('shared.transfers_empty_all_subtitle');

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('shared.transfers_title')}
        subtitle={t('web.transfers.subtitle')}
        actions={
          <Can perm={P.transfersCreate}>
            <Link
              href="/transfers/new"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-sm t-label text-primary-foreground hover:opacity-90"
            >
              {t('shared.transfer_create_title')}
            </Link>
          </Can>
        }
      />

      <div role="tablist" className="flex flex-wrap gap-xs border-b border-divider">
        {views.map((tab) => {
          const selected = tab.id === view;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                'border-b-2 px-md py-sm t-body transition-colors',
                selected
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
              onClick={() => setFilters({ view: tab.id, page: 1 })}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <FilterBar state={filters} onChange={setFilters} onReset={reset} storageKey="transfers.views">
        <SelectFilter
          name="status"
          label={t('web.transfers.status')}
          options={statusOptions}
          multiple
        />
        <SelectFilter name="type" label={t('web.transfers.type')} options={typeOptions} multiple />
        <DateRangeFilter from="dateFrom" to="dateTo" label={t('web.transfers.dateRange')} />
        <BranchFilter readAllPerm={P.transfersReadAll} />
      </FilterBar>

      <DataTable
        columns={columns}
        data={query.data?.data ?? []}
        meta={query.data?.meta}
        state={filters}
        onStateChange={setFilters}
        sortableColumns={[]}
        isLoading={query.isLoading}
        isFetching={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyState={
          <EmptyState
            filtered={hasActiveFilters}
            title={hasActiveFilters ? t('web.filters.filteredEmptyTitle') : emptyTitle}
            description={hasActiveFilters ? t('web.filters.filteredEmptyBody') : emptyBody}
          />
        }
        rowHref={(row) => `/transfers/${row.id}`}
        columnVisibility={{ storageKey: 'transfers.columns' }}
        density
        sticky={{ header: true, firstColumn: true }}
        selection={{ enabled: false }}
      />
    </div>
  );
}
