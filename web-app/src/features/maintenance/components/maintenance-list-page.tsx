'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { z } from 'zod';

import { Can } from '@/components/common/can';
import { DateText } from '@/components/common/date-text';
import { Money } from '@/components/common/money';
import { SerialText } from '@/components/common/serial-text';
import { StatusChip } from '@/components/common/status-chip';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/feedback/page-header';
import {
  BranchFilter,
  DateRangeFilter,
  FilterBar,
  LookupFilter,
  SelectFilter,
} from '@/components/filter-bar/filter-bar';
import { Link } from '@/i18n/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { useUrlFilters } from '@/lib/query/hooks';
import { MAINTENANCE_STATUS_TONE } from '@/lib/theme/status-tone';
import { cn } from '@/lib/utils';

import { useMaintenanceList } from '../hooks';
import { asNumber } from '../lib/value';
import { MAINTENANCE_STATUSES, type MaintenanceOrderListItem } from '../model';

const filtersSchema = z.object({
  status: z.union([z.string(), z.array(z.string())]).optional(),
  locationId: z.string().optional(),
  machineId: z.string().optional(),
  branchId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

const defaults = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt' as const,
  sortDir: 'desc' as const,
};

function normalizeList(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

export function MaintenanceListPage() {
  const t = useTranslations();
  const { permissions } = useSession();
  const canSeeMoney = can(permissions, P.financeRead);
  const [filters, setFilters, reset] = useUrlFilters(filtersSchema, defaults);

  const listParams = useMemo(
    () => ({
      page: filters.page,
      limit: filters.limit,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      status: normalizeList(filters.status),
      locationId: filters.locationId,
      machineId: filters.machineId,
      branchId: filters.branchId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }),
    [filters],
  );

  const query = useMaintenanceList(listParams);

  const hasActiveFilters = Boolean(
    filters.status ||
      filters.locationId ||
      filters.machineId ||
      filters.branchId ||
      filters.dateFrom ||
      filters.dateTo,
  );

  const statusOptions = useMemo(
    () =>
      MAINTENANCE_STATUSES.map((value) => ({
        value,
        label: t(`enums.maintenanceStatus.${value}` as 'enums.maintenanceStatus.UNKNOWN'),
      })),
    [t],
  );

  const columns = useMemo<DataTableColumn<MaintenanceOrderListItem>[]>(
    () => [
      {
        id: 'referenceNo',
        accessorKey: 'referenceNo',
        enableSorting: false,
        header: t('web.maintenance.orderNo'),
        meta: { label: t('web.maintenance.orderNo'), locked: true },
        cell: ({ row }) => (
          <Link
            href={`/maintenance/${row.original.id}`}
            className="t-mono text-primary hover:underline"
          >
            {row.original.referenceNo}
          </Link>
        ),
      },
      {
        id: 'serial',
        enableSorting: false,
        header: t('web.machines.serial'),
        meta: { label: t('web.machines.serial') },
        cell: ({ row }) => (
          <Link href={`/machines/${row.original.machine.id}`} className="hover:underline">
            <SerialText value={row.original.machine.serial} />
          </Link>
        ),
      },
      {
        id: 'status',
        enableSorting: false,
        header: t('web.maintenance.status'),
        meta: { label: t('web.maintenance.status') },
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <StatusChip
              status={status}
              tone={MAINTENANCE_STATUS_TONE[status] ?? 'neutral'}
              label={t(`enums.maintenanceStatus.${status}` as 'enums.maintenanceStatus.UNKNOWN')}
            />
          );
        },
      },
      {
        id: 'location',
        enableSorting: false,
        header: t('web.maintenance.location'),
        meta: { label: t('web.maintenance.location') },
        cell: ({ row }) => row.original.location.name,
      },
      {
        id: 'sentAt',
        accessorKey: 'sentAt',
        header: t('web.maintenance.sentAt'),
        meta: { label: t('web.maintenance.sentAt') },
        cell: ({ row }) => <DateText value={row.original.sentAt} format="datetime" />,
      },
      {
        id: 'returnedAt',
        enableSorting: false,
        header: t('web.maintenance.returnedAt'),
        meta: { label: t('web.maintenance.returnedAt') },
        cell: ({ row }) => (
          <DateText
            value={typeof row.original.returnedAt === 'string' ? row.original.returnedAt : null}
            format="datetime"
          />
        ),
      },
      {
        id: 'cost',
        accessorKey: 'cost',
        header: t('web.maintenance.cost'),
        meta: { label: t('web.maintenance.cost') },
        cell: ({ row }) =>
          canSeeMoney ? <Money value={asNumber(row.original.cost)} /> : t('web.common.moneyHidden'),
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: t('web.maintenance.createdAt'),
        meta: { label: t('web.maintenance.createdAt') },
        cell: ({ row }) => <DateText value={row.original.createdAt} />,
      },
    ],
    [canSeeMoney, t],
  );

  const subNav = [
    { href: '/maintenance', label: t('web.maintenance.navOrders'), active: true },
    { href: '/maintenance/replacements', label: t('web.maintenance.navReplacements') },
    { href: '/maintenance/decommissions', label: t('web.maintenance.navDecommissions') },
  ];

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('web.maintenance.title')}
        subtitle={t('web.maintenance.subtitle')}
        actions={
          <Can perm={P.maintenanceCreate}>
            <Link
              href="/maintenance/new"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 t-body text-primary-foreground hover:opacity-90"
            >
              {t('web.maintenance.new')}
            </Link>
          </Can>
        }
      />

      <nav className="flex flex-wrap gap-xs border-b border-divider" aria-label={t('web.maintenance.title')}>
        {subNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'border-b-2 px-md py-sm t-body',
              item.active
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <FilterBar state={filters} onChange={setFilters} onReset={reset} storageKey="maintenance.filters">
        <SelectFilter
          name="status"
          label={t('web.maintenance.status')}
          options={statusOptions}
          multiple
        />
        <LookupFilter
          name="locationId"
          label={t('web.maintenance.location')}
          endpoint={endpoints.lookups.maintenanceLocations}
        />
        <DateRangeFilter from="dateFrom" to="dateTo" label={t('web.maintenance.dateRange')} />
        <BranchFilter readAllPerm={P.machinesReadAll} />
      </FilterBar>

      <DataTable
        columns={columns}
        data={query.data?.data ?? []}
        meta={query.data?.meta}
        state={filters}
        onStateChange={setFilters}
        sortableColumns={['sentAt', 'createdAt', 'cost']}
        isLoading={query.isLoading}
        isFetching={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyState={
          <EmptyState
            filtered={hasActiveFilters}
            title={
              hasActiveFilters
                ? t('web.filters.filteredEmptyTitle')
                : t('web.filters.emptyTitle')
            }
            description={
              hasActiveFilters
                ? t('web.filters.filteredEmptyBody')
                : t('web.maintenance.emptyBody')
            }
          />
        }
        rowHref={(row) => `/maintenance/${row.id}`}
        columnVisibility={{ storageKey: 'maintenance.columns' }}
        density
        sticky={{ header: true, firstColumn: true }}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
