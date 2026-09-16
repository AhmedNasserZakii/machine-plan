'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { z } from 'zod';

import { Can } from '@/components/common/can';
import { PhoneText } from '@/components/common/phone-text';
import { StatusChip } from '@/components/common/status-chip';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/feedback/page-header';
import {
  BooleanFilter,
  BranchFilter,
  FilterBar,
  SearchFilter,
} from '@/components/filter-bar/filter-bar';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { useUrlFilters } from '@/lib/query/hooks';

import { useMerchantsList } from '../hooks';
import type { MerchantListItem } from '../model';

const filtersSchema = z.object({
  search: z.string().optional(),
  branchId: z.string().optional(),
  isActive: z.union([z.boolean(), z.string()]).optional(),
  hasMachines: z.union([z.boolean(), z.string()]).optional(),
  createdByUserId: z.string().optional(),
  includeInactive: z.union([z.boolean(), z.string()]).optional(),
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

function asBool(value: boolean | string | undefined): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export function MerchantsListPage() {
  const t = useTranslations();
  const { permissions } = useSession();
  const [filters, setFilters, reset] = useUrlFilters(filtersSchema, defaults);

  const isActive = asBool(filters.isActive);
  const hasMachines = asBool(filters.hasMachines);
  const includeInactive = asBool(filters.includeInactive);

  const listParams = useMemo(
    () => ({
      page: filters.page,
      limit: filters.limit,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      search: filters.search,
      branchId: can(permissions, P.merchantsReadAll) ? filters.branchId : undefined,
      createdByUserId: filters.createdByUserId,
      hasMachines,
      isActive: includeInactive ? undefined : isActive,
      includeInactive: includeInactive || undefined,
    }),
    [filters, hasMachines, includeInactive, isActive, permissions],
  );

  const query = useMerchantsList(listParams);

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.branchId ||
      filters.isActive !== undefined ||
      filters.hasMachines !== undefined ||
      filters.createdByUserId ||
      includeInactive,
  );

  const columns = useMemo<DataTableColumn<MerchantListItem>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: t('web.merchants.name'),
        meta: { label: t('web.merchants.name'), locked: true },
        cell: ({ row }) => (
          <Link href={`/merchants/${row.original.id}`} className="font-medium text-primary hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      {
        id: 'shopName',
        accessorKey: 'shopName',
        header: t('web.merchants.shopName'),
        meta: { label: t('web.merchants.shopName') },
      },
      {
        id: 'phone',
        enableSorting: false,
        header: t('web.merchants.phone'),
        meta: { label: t('web.merchants.phone') },
        cell: ({ row }) => <PhoneText value={row.original.phone} />,
      },
      {
        id: 'branch',
        enableSorting: false,
        header: t('web.merchants.branch'),
        meta: { label: t('web.merchants.branch') },
        cell: ({ row }) => row.original.branch?.name ?? '—',
      },
      {
        id: 'machinesCount',
        enableSorting: false,
        header: t('web.merchants.machinesCount'),
        meta: { label: t('web.merchants.machinesCount') },
        cell: ({ row }) => row.original.machinesCount,
      },
      {
        id: 'status',
        enableSorting: false,
        header: t('web.merchants.status'),
        meta: { label: t('web.merchants.status') },
        cell: ({ row }) => (
          <StatusChip
            status={row.original.isActive ? 'ACTIVE' : 'INACTIVE'}
            tone={row.original.isActive ? 'success' : 'neutral'}
            label={
              row.original.isActive
                ? t('web.merchants.active')
                : t('web.merchants.inactive')
            }
          />
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('web.merchants.title')}
        subtitle={t('web.merchants.subtitle')}
        actions={
          <Can perm={P.merchantsCreate}>
            <Link
              href="/merchants/new"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 t-body text-primary-fg hover:opacity-90"
            >
              {t('web.merchants.new')}
            </Link>
          </Can>
        }
      />

      <FilterBar state={filters} onChange={setFilters} onReset={reset} storageKey="merchants.filters">
        <SearchFilter name="search" />
        <BranchFilter readAllPerm={P.merchantsReadAll} />
        <BooleanFilter name="isActive" label={t('web.merchants.activeFilter')} />
        <BooleanFilter name="hasMachines" label={t('web.merchants.hasMachines')} />
        <BooleanFilter name="includeInactive" label={t('web.merchants.includeInactive')} />
      </FilterBar>

      <DataTable
        columns={columns}
        data={query.data?.data ?? []}
        meta={query.data?.meta}
        state={filters}
        onStateChange={setFilters}
        sortableColumns={['createdAt', 'name', 'shopName']}
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
                : t('web.merchants.emptyBody')
            }
          />
        }
        rowHref={(row) => `/merchants/${row.id}`}
        columnVisibility={{ storageKey: 'merchants.columns' }}
        density
        sticky={{ header: true, firstColumn: true }}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
