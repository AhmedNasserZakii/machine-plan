'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { z } from 'zod';

import { Can } from '@/components/common/can';
import { DateText } from '@/components/common/date-text';
import { PhoneText } from '@/components/common/phone-text';
import { StatusChip } from '@/components/common/status-chip';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/feedback/page-header';
import {
  BooleanFilter,
  FilterBar,
  SearchFilter,
  SelectFilter,
} from '@/components/filter-bar/filter-bar';
import { Link } from '@/i18n/navigation';
import { P } from '@/lib/auth/permissions';
import { useUrlFilters } from '@/lib/query/hooks';

import { useBranchesOptions, useRolesOptions, useUsersList } from '../hooks';
import { asText } from '../lib/value';
import type { User } from '../model';

const filtersSchema = z.object({
  search: z.string().optional(),
  roleId: z.string().optional(),
  branchId: z.string().optional(),
  isActive: z.union([z.boolean(), z.string()]).optional(),
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

export function UsersListPage() {
  const t = useTranslations();
  const [filters, setFilters, reset] = useUrlFilters(filtersSchema, defaults);
  const roles = useRolesOptions();
  const branches = useBranchesOptions();

  const isActive = asBool(filters.isActive);
  const listParams = useMemo(
    () => ({
      page: filters.page,
      limit: filters.limit,
      sortBy: (filters.sortBy as 'fullName' | 'phone' | 'createdAt' | 'lastLoginAt') ?? 'createdAt',
      sortDir: filters.sortDir,
      search: filters.search,
      roleId: filters.roleId,
      branchId: filters.branchId,
      isActive,
    }),
    [filters, isActive],
  );

  const query = useUsersList(listParams);
  const hasActiveFilters = Boolean(
    filters.search || filters.roleId || filters.branchId || filters.isActive !== undefined,
  );

  const roleOptions = useMemo(
    () => (roles.data ?? []).map((r) => ({ value: r.id, label: r.displayName })),
    [roles.data],
  );
  const branchOptions = useMemo(
    () => (branches.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    [branches.data],
  );

  const columns = useMemo<DataTableColumn<User>[]>(
    () => [
      {
        id: 'fullName',
        accessorKey: 'fullName',
        header: t('web.users.fullName'),
        meta: { label: t('web.users.fullName'), locked: true },
        cell: ({ row }) => (
          <Link href={`/users/${row.original.id}`} className="font-medium text-primary hover:underline">
            {row.original.fullName}
          </Link>
        ),
      },
      {
        id: 'phone',
        accessorKey: 'phone',
        header: t('web.users.phone'),
        meta: { label: t('web.users.phone') },
        cell: ({ row }) => <PhoneText value={row.original.phone} />,
      },
      {
        id: 'role',
        enableSorting: false,
        header: t('web.users.role'),
        meta: { label: t('web.users.role') },
        cell: ({ row }) => row.original.role.displayName,
      },
      {
        id: 'branch',
        enableSorting: false,
        header: t('web.users.branch'),
        meta: { label: t('web.users.branch') },
        cell: ({ row }) => asText(row.original.branchId) ?? '—',
      },
      {
        id: 'status',
        enableSorting: false,
        header: t('web.users.status'),
        meta: { label: t('web.users.status') },
        cell: ({ row }) => (
          <StatusChip
            status={row.original.isActive ? 'ACTIVE' : 'INACTIVE'}
            tone={row.original.isActive ? 'success' : 'neutral'}
            label={row.original.isActive ? t('web.users.active') : t('web.users.inactive')}
          />
        ),
      },
      {
        id: 'lastLoginAt',
        accessorKey: 'lastLoginAt',
        header: t('web.users.lastLogin'),
        meta: { label: t('web.users.lastLogin') },
        cell: ({ row }) => {
          const value = asText(row.original.lastLoginAt);
          return value ? <DateText value={value} /> : '—';
        },
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: t('web.users.createdAt'),
        meta: { label: t('web.users.createdAt') },
        cell: ({ row }) => <DateText value={row.original.createdAt} />,
      },
    ],
    [t],
  );

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('web.users.title')}
        subtitle={t('web.users.subtitle')}
        actions={
          <Can perm={P.usersCreate}>
            <Link
              href="/users/new"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 t-body text-primary-fg hover:opacity-90"
            >
              {t('web.users.new')}
            </Link>
          </Can>
        }
      />

      <FilterBar state={filters} onChange={setFilters} onReset={reset} storageKey="users.filters">
        <SearchFilter name="search" />
        <SelectFilter name="roleId" label={t('web.users.role')} options={roleOptions} />
        <SelectFilter name="branchId" label={t('web.users.branch')} options={branchOptions} />
        <BooleanFilter name="isActive" label={t('web.users.activeFilter')} />
      </FilterBar>

      <DataTable
        columns={columns}
        data={query.data?.data ?? []}
        meta={query.data?.meta}
        state={filters}
        onStateChange={setFilters}
        sortableColumns={['fullName', 'phone', 'createdAt', 'lastLoginAt']}
        isLoading={query.isLoading}
        isFetching={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyState={
          <EmptyState
            filtered={hasActiveFilters}
            title={
              hasActiveFilters ? t('web.filters.filteredEmptyTitle') : t('web.filters.emptyTitle')
            }
            description={
              hasActiveFilters ? t('web.filters.filteredEmptyBody') : t('web.users.emptyBody')
            }
          />
        }
      />
    </div>
  );
}
