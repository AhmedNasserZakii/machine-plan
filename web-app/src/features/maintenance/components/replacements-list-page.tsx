'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { z } from 'zod';

import { DateText } from '@/components/common/date-text';
import { SerialText } from '@/components/common/serial-text';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/feedback/page-header';
import { DateRangeFilter, FilterBar } from '@/components/filter-bar/filter-bar';
import { Link } from '@/i18n/navigation';
import { useUrlFilters } from '@/lib/query/hooks';
import { cn } from '@/lib/utils';

import { useReplacementsList } from '../hooks';
import type { ReplacementResponse } from '../model';

const filtersSchema = z.object({
  machineId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

const defaults = {
  page: 1,
  limit: 20,
  sortDir: 'desc' as const,
};

export function ReplacementsListPage() {
  const t = useTranslations();
  const [filters, setFilters, reset] = useUrlFilters(filtersSchema, defaults);

  const listParams = useMemo(
    () => ({
      page: filters.page,
      limit: filters.limit,
      sortDir: filters.sortDir,
      machineId: filters.machineId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }),
    [filters],
  );

  const query = useReplacementsList(listParams);
  const hasActiveFilters = Boolean(filters.machineId || filters.dateFrom || filters.dateTo);

  const columns = useMemo<DataTableColumn<ReplacementResponse>[]>(
    () => [
      {
        id: 'old',
        enableSorting: false,
        header: t('web.maintenance.oldSerial'),
        meta: { label: t('web.maintenance.oldSerial'), locked: true },
        cell: ({ row }) => (
          <Link href={`/machines/${row.original.oldMachine.id}`} className="hover:underline">
            <SerialText value={row.original.oldMachine.serial} />
          </Link>
        ),
      },
      {
        id: 'new',
        enableSorting: false,
        header: t('web.maintenance.newSerial'),
        meta: { label: t('web.maintenance.newSerial') },
        cell: ({ row }) => (
          <Link href={`/machines/${row.original.newMachine.id}`} className="hover:underline">
            <SerialText value={row.original.newMachine.serial} />
          </Link>
        ),
      },
      {
        id: 'reason',
        enableSorting: false,
        header: t('web.maintenance.replaceReason'),
        meta: { label: t('web.maintenance.replaceReason') },
        cell: ({ row }) => row.original.reason,
      },
      {
        id: 'replacedAt',
        enableSorting: false,
        header: t('web.maintenance.replacedAt'),
        meta: { label: t('web.maintenance.replacedAt') },
        cell: ({ row }) => <DateText value={row.original.replacedAt} format="datetime" />,
      },
    ],
    [t],
  );

  const subNav = [
    { href: '/maintenance', label: t('web.maintenance.navOrders') },
    {
      href: '/maintenance/replacements',
      label: t('web.maintenance.navReplacements'),
      active: true,
    },
    { href: '/maintenance/decommissions', label: t('web.maintenance.navDecommissions') },
  ];

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('web.maintenance.replacementsTitle')}
        subtitle={t('web.maintenance.replacementsSubtitle')}
      />

      <nav
        className="flex flex-wrap gap-xs border-b border-divider"
        aria-label={t('web.maintenance.title')}
      >
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

      <FilterBar
        state={filters}
        onChange={setFilters}
        onReset={reset}
        storageKey="replacements.filters"
      >
        <DateRangeFilter from="dateFrom" to="dateTo" label={t('web.maintenance.dateRange')} />
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
            title={
              hasActiveFilters
                ? t('web.filters.filteredEmptyTitle')
                : t('web.filters.emptyTitle')
            }
            description={
              hasActiveFilters
                ? t('web.filters.filteredEmptyBody')
                : t('web.maintenance.replacementsEmpty')
            }
          />
        }
        density
        sticky={{ header: true, firstColumn: true }}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
