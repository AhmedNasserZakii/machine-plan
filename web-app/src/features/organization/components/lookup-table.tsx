'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { StatusChip } from '@/components/common/status-chip';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { AppForm } from '@/components/form/app-form';
import { SelectField } from '@/components/form/fields/select-field';
import { SwitchField } from '@/components/form/fields/switch-field';
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

import { useCreateLookupMutation, useLookupTab, useUpdateLookupMutation } from '../hooks';
import type { LookupTab } from '../model';

type Row = {
  id: string;
  code?: string;
  name: string;
  isActive: boolean;
  requiresSim?: boolean;
  defaultSeverity?: string;
  manufacturer?: string | null;
  machineType?: { name: string } | null;
  translations?: unknown;
};

const nameSchema = z.object({
  code: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  nameEn: z.string().trim().min(1),
  requiresSim: z.boolean().optional(),
  defaultSeverity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  manufacturer: z.string().optional(),
  machineTypeId: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

function translationName(row: Row, locale: 'ar' | 'en'): string {
  const tr = row.translations;
  if (tr && typeof tr === 'object' && locale in (tr as object)) {
    const loc = (tr as Record<string, { name?: string }>)[locale];
    if (loc?.name) return loc.name;
  }
  return row.name;
}

export function LookupTable({ tab }: { tab: LookupTab }) {
  const t = useTranslations();
  const query = useLookupTab(tab);
  const create = useCreateLookupMutation(tab);
  const update = useUpdateLookupMutation(tab);
  const [open, setOpen] = useState(false);
  const canUpdate = ['types', 'models', 'payment-methods', 'violation-types'].includes(tab);

  const rows = (query.data ?? []) as Row[];

  const columns = useMemo<DataTableColumn<Row>[]>(() => {
    const cols: DataTableColumn<Row>[] = [
      {
        id: 'nameAr',
        header: t('web.organization.nameAr'),
        meta: { label: t('web.organization.nameAr'), locked: true },
        cell: ({ row }) => translationName(row.original, 'ar'),
      },
      {
        id: 'nameEn',
        header: t('web.organization.nameEn'),
        meta: { label: t('web.organization.nameEn') },
        cell: ({ row }) => translationName(row.original, 'en'),
      },
    ];
    if (tab !== 'suppliers') {
      cols.push({
        id: 'code',
        header: t('web.organization.code'),
        meta: { label: t('web.organization.code') },
        cell: ({ row }) => (
          <bdi dir="ltr" className="t-mono">
            {row.original.code ?? '—'}
          </bdi>
        ),
      });
    }
    if (tab === 'types') {
      cols.push({
        id: 'requiresSim',
        header: t('web.organization.requiresSim'),
        meta: { label: t('web.organization.requiresSim') },
        cell: ({ row }) => (row.original.requiresSim ? t('web.common.yes') : t('web.common.no')),
      });
    }
    if (tab === 'violation-types') {
      cols.push({
        id: 'severity',
        header: t('web.organization.defaultSeverity'),
        meta: { label: t('web.organization.defaultSeverity') },
        cell: ({ row }) =>
          row.original.defaultSeverity
            ? t(`enums.severity.${row.original.defaultSeverity}` as 'enums.severity.MEDIUM')
            : '—',
      });
    }
    if (tab === 'models') {
      cols.push({
        id: 'type',
        header: t('web.organization.machineType'),
        meta: { label: t('web.organization.machineType') },
        cell: ({ row }) => row.original.machineType?.name ?? '—',
      });
    }
    cols.push({
      id: 'status',
      header: t('web.organization.status'),
      meta: { label: t('web.organization.status') },
      cell: ({ row }) => (
        <div className="flex items-center gap-sm">
          <StatusChip
            status={row.original.isActive ? 'ACTIVE' : 'INACTIVE'}
            tone={row.original.isActive ? 'success' : 'neutral'}
            label={row.original.isActive ? t('web.users.active') : t('web.users.inactive')}
          />
          {canUpdate && row.original.isActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await update.mutateAsync({ id: row.original.id, body: { isActive: false } });
                  toast.success(t('web.organization.lookupDeactivated'));
                } catch (error) {
                  toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
                }
              }}
            >
              {t('web.organization.deactivate')}
            </Button>
          ) : null}
        </div>
      ),
    });
    return cols;
  }, [canUpdate, t, tab, update]);

  if (query.isLoading) return <TableSkeleton rows={6} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-md">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setOpen(true)}>
          {t('web.organization.newLookup')}
        </Button>
      </div>
      <p className="t-caption text-text-secondary">{t('web.organization.deactivateNotDelete')}</p>
      <DataTable
        columns={columns}
        data={rows}
        state={{}}
        onStateChange={() => undefined}
        emptyState={<EmptyState title={t('web.filters.emptyTitle')} description={t('web.organization.lookupsEmpty')} />}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('web.organization.newLookup')}</DialogTitle>
          </DialogHeader>
          <AppForm
            schema={nameSchema}
            defaultValues={{
              code: '',
              nameAr: '',
              nameEn: '',
              requiresSim: true,
              defaultSeverity: 'MEDIUM' as const,
              manufacturer: '',
              machineTypeId: '',
              phone: '',
              notes: '',
            }}
            dirtyGuard={false}
            onSubmit={async (values) => {
              try {
                if (tab === 'suppliers') {
                  await create.mutateAsync({
                    name: values.nameAr,
                    phone: values.phone || undefined,
                    notes: values.notes || undefined,
                  });
                } else if (tab === 'types') {
                  await create.mutateAsync({
                    code: values.code,
                    isActive: true,
                    sortOrder: 0,
                    requiresSim: values.requiresSim ?? true,
                    translations: {
                      ar: { name: values.nameAr },
                      en: { name: values.nameEn },
                    },
                  });
                } else if (tab === 'violation-types') {
                  await create.mutateAsync({
                    code: values.code,
                    isActive: true,
                    sortOrder: 0,
                    defaultSeverity: values.defaultSeverity ?? 'MEDIUM',
                    translations: {
                      ar: { name: values.nameAr },
                      en: { name: values.nameEn },
                    },
                  });
                } else if (tab === 'models') {
                  await create.mutateAsync({
                    code: values.code,
                    isActive: true,
                    sortOrder: 0,
                    machineTypeId: values.machineTypeId,
                    manufacturer: values.manufacturer || undefined,
                    translations: {
                      ar: { name: values.nameAr },
                      en: { name: values.nameEn },
                    },
                  });
                } else {
                  await create.mutateAsync({
                    code: values.code,
                    isActive: true,
                    sortOrder: 0,
                    translations: {
                      ar: { name: values.nameAr },
                      en: { name: values.nameEn },
                    },
                  });
                }
                toast.success(t('web.organization.lookupCreated'));
                setOpen(false);
              } catch (error) {
                toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
              }
            }}
          >
            {tab !== 'suppliers' ? (
              <TextField name="code" label={t('web.organization.code')} required dir="ltr" />
            ) : null}
            <TextField name="nameAr" label={t('web.organization.nameAr')} required />
            <TextField name="nameEn" label={t('web.organization.nameEn')} required />
            {tab === 'types' ? <SwitchField name="requiresSim" label={t('web.organization.requiresSim')} /> : null}
            {tab === 'violation-types' ? (
              <SelectField
                name="defaultSeverity"
                label={t('web.organization.defaultSeverity')}
                options={(['LOW', 'MEDIUM', 'HIGH'] as const).map((s) => ({
                  value: s,
                  label: t(`enums.severity.${s}` as 'enums.severity.MEDIUM'),
                }))}
              />
            ) : null}
            {tab === 'models' ? (
              <>
                <TextField name="machineTypeId" label={t('web.organization.machineTypeId')} required dir="ltr" />
                <TextField name="manufacturer" label={t('web.organization.manufacturer')} />
              </>
            ) : null}
            {tab === 'suppliers' ? (
              <>
                <TextField name="phone" label={t('web.organization.phone')} dir="ltr" />
                <TextField name="notes" label={t('web.organization.notes')} />
              </>
            ) : null}
            <FormActions submitLabel={t('web.organization.create')} onCancel={() => setOpen(false)} />
          </AppForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
