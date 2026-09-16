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
import { AppForm } from '@/components/form/app-form';
import { SelectField } from '@/components/form/fields/select-field';
import { TextField } from '@/components/form/fields/text-field';
import { FormActions } from '@/components/form/form-actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api/client';
import { P } from '@/lib/auth/permissions';

import { useBranchesList, useCreateWarehouseMutation, useWarehousesList } from '../hooks';
import type { Warehouse } from '../model';

const schema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['COMPANY_MAIN', 'BRANCH', 'SCRAP', 'MAINTENANCE']),
  branchId: z.string().optional(),
});

export function WarehousesListPage() {
  const t = useTranslations();
  const query = useWarehousesList({ limit: 100 });
  const branches = useBranchesList({ limit: 100 });
  const create = useCreateWarehouseMutation();
  const [open, setOpen] = useState(false);

  const branchOptions = useMemo(
    () => (branches.data?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    [branches.data],
  );

  const columns = useMemo<DataTableColumn<Warehouse>[]>(
    () => [
      {
        id: 'name',
        header: t('web.organization.warehouseName'),
        meta: { label: t('web.organization.warehouseName'), locked: true },
        cell: ({ row }) => row.original.name,
      },
      {
        id: 'type',
        header: t('web.organization.warehouseKind'),
        meta: { label: t('web.organization.warehouseKind') },
        cell: ({ row }) => t(`enums.warehouseKind.${row.original.type}` as 'enums.warehouseKind.BRANCH'),
      },
      {
        id: 'branch',
        header: t('web.organization.branch'),
        meta: { label: t('web.organization.branch') },
        cell: ({ row }) =>
          branchOptions.find((b) => b.value === (row.original.branchId as unknown as string))?.label ??
          (typeof row.original.branchId === 'string' ? row.original.branchId : '—'),
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
    [branchOptions, t],
  );

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('web.organization.warehouses')}
        subtitle={t('web.organization.warehousesSubtitle')}
        actions={
          <Can perm={P.branchesManage}>
            <Button type="button" onClick={() => setOpen(true)}>
              {t('web.organization.newWarehouse')}
            </Button>
          </Can>
        }
      />
      <DataTable
        columns={columns}
        data={query.data?.data ?? []}
        meta={query.data?.meta}
        state={{}}
        onStateChange={() => undefined}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyState={
          <EmptyState title={t('web.filters.emptyTitle')} description={t('web.organization.warehousesEmpty')} />
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('web.organization.newWarehouse')}</DialogTitle>
          </DialogHeader>
          <AppForm
            schema={schema}
            defaultValues={{ name: '', type: 'BRANCH' as const, branchId: '' }}
            dirtyGuard={false}
            onSubmit={async (values) => {
              try {
                await create.mutateAsync({
                  name: values.name,
                  type: values.type,
                  branchId: values.type === 'BRANCH' ? values.branchId || undefined : undefined,
                });
                toast.success(t('web.organization.warehouseCreated'));
                setOpen(false);
              } catch (error) {
                toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
              }
            }}
          >
            <TextField name="name" label={t('web.organization.warehouseName')} required />
            <SelectField
              name="type"
              label={t('web.organization.warehouseKind')}
              required
              options={(['COMPANY_MAIN', 'BRANCH', 'SCRAP', 'MAINTENANCE'] as const).map((k) => ({
                value: k,
                label: t(`enums.warehouseKind.${k}` as 'enums.warehouseKind.BRANCH'),
              }))}
            />
            <SelectField name="branchId" label={t('web.organization.branch')} options={branchOptions} />
            <FormActions submitLabel={t('web.organization.create')} onCancel={() => setOpen(false)} />
          </AppForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
