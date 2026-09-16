'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { StatusChip } from '@/components/common/status-chip';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { Link } from '@/i18n/navigation';

import { useRolesList } from '../hooks';
import type { Role } from '../model';

export function RolesListPage() {
  const t = useTranslations();
  const query = useRolesList();

  const columns = useMemo<DataTableColumn<Role>[]>(
    () => [
      {
        id: 'displayName',
        header: t('web.roles.name'),
        meta: { label: t('web.roles.name'), locked: true },
        cell: ({ row }) => (
          <Link href={`/roles/${row.original.id}`} className="font-medium text-primary hover:underline">
            {row.original.displayName}
          </Link>
        ),
      },
      {
        id: 'code',
        header: t('web.roles.code'),
        meta: { label: t('web.roles.code') },
        cell: ({ row }) => (
          <bdi dir="ltr" className="t-mono">
            {row.original.code}
          </bdi>
        ),
      },
      {
        id: 'system',
        header: t('web.roles.system'),
        meta: { label: t('web.roles.system') },
        cell: ({ row }) =>
          row.original.isSystem ? (
            <StatusChip status="SYSTEM" tone="info" label={t('web.roles.systemBadge')} />
          ) : (
            '—'
          ),
      },
      {
        id: 'permissionCount',
        header: t('web.roles.permissionCount'),
        meta: { label: t('web.roles.permissionCount') },
        cell: ({ row }) => row.original.permissionCount,
      },
    ],
    [t],
  );

  if (query.isLoading) return <TableSkeleton rows={6} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-md">
      <PageHeader title={t('web.roles.title')} subtitle={t('web.roles.subtitle')} />
      <DataTable
        columns={columns}
        data={query.data ?? []}
        isLoading={false}
        state={{ page: 1, limit: 50 }}
        onStateChange={() => undefined}
        emptyState={<EmptyState title={t('web.filters.emptyTitle')} description={t('web.roles.emptyBody')} />}
      />
    </div>
  );
}
