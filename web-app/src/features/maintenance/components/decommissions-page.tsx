'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { Can } from '@/components/common/can';
import { DateText } from '@/components/common/date-text';
import { Money } from '@/components/common/money';
import { SerialText } from '@/components/common/serial-text';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/feedback/page-header';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { useUrlFilters } from '@/lib/query/hooks';
import { cn } from '@/lib/utils';

import { useDecommissionCandidates, useDecommissionsList } from '../hooks';
import { asNumber, asText } from '../lib/value';
import type { Decommission, DecommissionCandidate } from '../model';
import {
  DecommissionDialog,
  RevertDecommissionDialog,
} from './decommission-dialog';

const filtersSchema = z.object({
  tab: z.enum(['candidates', 'history']).optional(),
  machineId: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  sortBy: z.string().optional(),
});

const defaults = {
  tab: 'candidates' as const,
  page: 1,
  limit: 20,
  sortDir: 'desc' as const,
  sortBy: 'decommissionedAt' as const,
};

function formatRatio(value: unknown): string {
  const ratio = asNumber(value);
  if (ratio === null) return '—';
  const pct = ratio <= 1 ? ratio * 100 : ratio;
  return `${Math.round(pct)}%`;
}

export function DecommissionsPage() {
  const t = useTranslations();
  const { permissions } = useSession();
  const canSeeMoney = can(permissions, P.financeRead);
  const searchParams = useSearchParams();
  const prefillMachineId = searchParams.get('machineId') ?? undefined;
  const [filters, setFilters] = useUrlFilters(filtersSchema, {
    ...defaults,
    machineId: prefillMachineId,
  });
  const tab = filters.tab ?? 'candidates';

  const [decommissionTarget, setDecommissionTarget] = useState<{
    id: string;
    serial: string;
    costRatio: number | null;
  } | null>(null);
  const [revertTarget, setRevertTarget] = useState<{ id: string; serial: string } | null>(
    null,
  );
  const [prefillHandled, setPrefillHandled] = useState(false);

  const candidates = useDecommissionCandidates({
    page: filters.page,
    limit: filters.limit,
  });
  const history = useDecommissionsList({
    page: filters.page,
    limit: filters.limit,
    sortDir: filters.sortDir,
    sortBy: filters.sortBy,
    machineId: filters.machineId,
  });

  const prefillMachine = useQuery({
    queryKey: ['machines', 'decommission-prefill', prefillMachineId],
    enabled: Boolean(prefillMachineId) && !prefillHandled,
    queryFn: async () => {
      const result = await api.get<{
        id: string;
        serial: string;
        maintenance?: { costVsPricePercent?: unknown };
      }>(endpoints.machines.byId(prefillMachineId!));
      return result.data;
    },
  });

  useEffect(() => {
    if (prefillHandled || !prefillMachineId || !prefillMachine.data) return;
    setDecommissionTarget({
      id: prefillMachine.data.id,
      serial: prefillMachine.data.serial,
      costRatio: asNumber(prefillMachine.data.maintenance?.costVsPricePercent),
    });
    setPrefillHandled(true);
  }, [prefillHandled, prefillMachine.data, prefillMachineId]);

  const candidateColumns = useMemo<DataTableColumn<DecommissionCandidate>[]>(
    () => [
      {
        id: 'serial',
        enableSorting: false,
        header: t('web.machines.serial'),
        meta: { label: t('web.machines.serial'), locked: true },
        cell: ({ row }) => (
          <Link href={`/machines/${row.original.id}`} className="hover:underline">
            <SerialText value={row.original.serial} />
          </Link>
        ),
      },
      {
        id: 'repairCost',
        enableSorting: false,
        header: t('web.machines.totalRepairCost'),
        meta: { label: t('web.machines.totalRepairCost') },
        cell: ({ row }) =>
          canSeeMoney ? (
            <Money value={row.original.cumulativeRepairCost} />
          ) : (
            t('web.common.moneyHidden')
          ),
      },
      {
        id: 'ratio',
        enableSorting: false,
        header: t('web.machines.costVsPrice'),
        meta: { label: t('web.machines.costVsPrice') },
        cell: ({ row }) => formatRatio(row.original.costRatio),
      },
      {
        id: 'recommendation',
        enableSorting: false,
        header: t('web.machines.recommendation'),
        meta: { label: t('web.machines.recommendation') },
        cell: ({ row }) =>
          t(
            `web.machines.recommendation.${row.original.recommendation}` as 'web.machines.recommendation.KEEP',
          ),
      },
      {
        id: 'actions',
        enableSorting: false,
        header: t('web.common.actions'),
        meta: { label: t('web.common.actions') },
        cell: ({ row }) => (
          <Can perm={P.machinesDecommission}>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() =>
                setDecommissionTarget({
                  id: row.original.id,
                  serial: row.original.serial,
                  costRatio: asNumber(row.original.costRatio),
                })
              }
            >
              {t('web.machines.decommission')}
            </Button>
          </Can>
        ),
      },
    ],
    [canSeeMoney, t],
  );

  const historyColumns = useMemo<DataTableColumn<Decommission>[]>(
    () => [
      {
        id: 'serial',
        enableSorting: false,
        header: t('web.machines.serial'),
        meta: { label: t('web.machines.serial'), locked: true },
        cell: ({ row }) => (
          <Link href={`/machines/${row.original.machine.id}`} className="hover:underline">
            <SerialText value={row.original.machine.serial} />
          </Link>
        ),
      },
      {
        id: 'reason',
        enableSorting: false,
        header: t('web.maintenance.decommissionReason'),
        meta: { label: t('web.maintenance.decommissionReason') },
        cell: ({ row }) => row.original.reasonName,
      },
      {
        id: 'ratio',
        enableSorting: false,
        header: t('web.machines.costVsPrice'),
        meta: { label: t('web.machines.costVsPrice') },
        cell: ({ row }) => formatRatio(row.original.snapshot.costToValueRatio),
      },
      {
        id: 'decommissionedAt',
        accessorKey: 'decommissionedAt',
        header: t('web.maintenance.decommissionedAt'),
        meta: { label: t('web.maintenance.decommissionedAt') },
        cell: ({ row }) => <DateText value={row.original.decommissionedAt} format="datetime" />,
      },
      {
        id: 'actions',
        enableSorting: false,
        header: t('web.common.actions'),
        meta: { label: t('web.common.actions') },
        cell: ({ row }) => {
          if (asText(row.original.revertedAt)) {
            return (
              <span className="t-caption text-text-secondary">
                {t('web.maintenance.alreadyReverted')}
              </span>
            );
          }
          return (
            <Can perm={P.machinesDecommission}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setRevertTarget({
                    id: row.original.machine.id,
                    serial: row.original.machine.serial,
                  })
                }
              >
                {t('web.maintenance.revert')}
              </Button>
            </Can>
          );
        },
      },
    ],
    [t],
  );

  const subNav = [
    { href: '/maintenance', label: t('web.maintenance.navOrders') },
    { href: '/maintenance/replacements', label: t('web.maintenance.navReplacements') },
    {
      href: '/maintenance/decommissions',
      label: t('web.maintenance.navDecommissions'),
      active: true,
    },
  ];

  const tabs = [
    { id: 'candidates' as const, label: t('web.maintenance.tabCandidates') },
    { id: 'history' as const, label: t('web.maintenance.tabHistory') },
  ];

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('web.maintenance.decommissionsTitle')}
        subtitle={t('web.maintenance.decommissionsSubtitle')}
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

      <div role="tablist" className="flex flex-wrap gap-xs border-b border-divider">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={cn(
              'border-b-2 px-md py-sm t-body',
              tab === item.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
            onClick={() => setFilters({ tab: item.id, page: 1 })}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'candidates' ? (
        <DataTable
          columns={candidateColumns}
          data={candidates.data?.data ?? []}
          meta={candidates.data?.meta}
          state={filters}
          onStateChange={setFilters}
          sortableColumns={[]}
          isLoading={candidates.isLoading}
          isFetching={candidates.isFetching && !candidates.isLoading}
          error={candidates.error}
          onRetry={() => void candidates.refetch()}
          emptyState={
            <EmptyState
              title={t('web.filters.emptyTitle')}
              description={t('web.maintenance.candidatesEmpty')}
            />
          }
          density
          sticky={{ header: true, firstColumn: true }}
          getRowId={(row) => row.id}
        />
      ) : (
        <DataTable
          columns={historyColumns}
          data={history.data?.data ?? []}
          meta={history.data?.meta}
          state={filters}
          onStateChange={setFilters}
          sortableColumns={['decommissionedAt', 'createdAt']}
          isLoading={history.isLoading}
          isFetching={history.isFetching && !history.isLoading}
          error={history.error}
          onRetry={() => void history.refetch()}
          emptyState={
            <EmptyState
              title={t('web.filters.emptyTitle')}
              description={t('web.maintenance.historyEmpty')}
            />
          }
          density
          sticky={{ header: true, firstColumn: true }}
          getRowId={(row) => row.id}
        />
      )}

      {decommissionTarget ? (
        <DecommissionDialog
          machineId={decommissionTarget.id}
          serial={decommissionTarget.serial}
          costRatio={decommissionTarget.costRatio}
          open
          onOpenChange={(next) => {
            if (!next) setDecommissionTarget(null);
          }}
          onDone={() => {
            void candidates.refetch();
            void history.refetch();
            setFilters({ tab: 'history' });
          }}
        />
      ) : null}

      {revertTarget ? (
        <RevertDecommissionDialog
          machineId={revertTarget.id}
          serial={revertTarget.serial}
          open
          onOpenChange={(next) => {
            if (!next) setRevertTarget(null);
          }}
          onDone={() => void history.refetch()}
        />
      ) : null}
    </div>
  );
}
