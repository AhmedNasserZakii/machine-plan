'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Can } from '@/components/common/can';
import { StatusChip } from '@/components/common/status-chip';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/feedback/page-header';
import { FilterBar, SearchFilter } from '@/components/filter-bar/filter-bar';
import { AppForm } from '@/components/form/app-form';
import { TextField } from '@/components/form/fields/text-field';
import { FormActions } from '@/components/form/form-actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { P } from '@/lib/auth/permissions';
import { useUrlFilters } from '@/lib/query/hooks';

import { useBranchesList, useCreateBranchMutation } from '../hooks';
import type { Branch } from '../model';

const filtersSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

const createSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  warehouseName: z.string().optional(),
});

export function BranchesListPage() {
  const t = useTranslations();
  const [filters, setFilters, reset] = useUrlFilters(filtersSchema, { page: 1, limit: 20, sortDir: 'asc' as const });
  const query = useBranchesList({
    page: filters.page,
    limit: filters.limit,
    sortDir: filters.sortDir,
    search: filters.search,
  });
  const create = useCreateBranchMutation();
  const [createOpen, setCreateOpen] = useState(false);

  const columns = useMemo<DataTableColumn<Branch>[]>(
    () => [
      {
        id: 'name',
        header: t('web.organization.branchName'),
        meta: { label: t('web.organization.branchName'), locked: true },
        cell: ({ row }) => (
          <Link href={`/organization/branches/${row.original.id}`} className="font-medium text-primary hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      {
        id: 'code',
        header: t('web.organization.branchCode'),
        meta: { label: t('web.organization.branchCode') },
        cell: ({ row }) => (
          <bdi dir="ltr" className="t-mono">
            {row.original.code}
          </bdi>
        ),
      },
      {
        id: 'warehouse',
        header: t('web.organization.warehouse'),
        meta: { label: t('web.organization.warehouse') },
        cell: ({ row }) => row.original.warehouse?.name ?? '—',
      },
      {
        id: 'status',
        header: t('web.organization.status'),
        meta: { label: t('web.organization.status') },
        cell: ({ row }) => (
          <StatusChip
            status={row.original.isActive ? 'ACTIVE' : 'INACTIVE'}
            tone={row.original.isActive ? 'success' : 'neutral'}
            label={row.original.isActive ? t('web.users.active') : t('web.users.inactive')}
          />
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('web.organization.branches')}
        subtitle={t('web.organization.branchesSubtitle')}
        actions={
          <Can perm={P.branchesManage}>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              {t('web.organization.newBranch')}
            </Button>
          </Can>
        }
      />
      <FilterBar state={filters} onChange={setFilters} onReset={reset} storageKey="branches.filters">
        <SearchFilter name="search" />
      </FilterBar>
      <DataTable
        columns={columns}
        data={query.data?.data ?? []}
        meta={query.data?.meta}
        state={filters}
        onStateChange={setFilters}
        isLoading={query.isLoading}
        isFetching={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyState={
          <EmptyState title={t('web.filters.emptyTitle')} description={t('web.organization.branchesEmpty')} />
        }
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('web.organization.newBranch')}</DialogTitle>
          </DialogHeader>
          <AppForm
            schema={createSchema}
            defaultValues={{ code: '', name: '', address: '', phone: '', warehouseName: '' }}
            dirtyGuard={false}
            onSubmit={async (values) => {
              try {
                await create.mutateAsync({
                  code: values.code,
                  name: values.name,
                  address: values.address || undefined,
                  phone: values.phone || undefined,
                  warehouseName: values.warehouseName || undefined,
                });
                toast.success(t('web.organization.branchCreated'));
                setCreateOpen(false);
              } catch (error) {
                toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
              }
            }}
          >
            <TextField name="code" label={t('web.organization.branchCode')} required dir="ltr" />
            <TextField name="name" label={t('web.organization.branchName')} required />
            <TextField name="address" label={t('web.organization.address')} />
            <TextField name="phone" label={t('web.organization.phone')} dir="ltr" />
            <TextField name="warehouseName" label={t('web.organization.warehouseName')} />
            <FormActions submitLabel={t('web.organization.create')} onCancel={() => setCreateOpen(false)} />
          </AppForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
