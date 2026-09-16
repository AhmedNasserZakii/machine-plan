'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Can } from '@/components/common/can';
import { DateText } from '@/components/common/date-text';
import { HolderChip } from '@/components/common/holder-chip';
import { Money } from '@/components/common/money';
import { SerialText } from '@/components/common/serial-text';
import { StatusChip } from '@/components/common/status-chip';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/feedback/page-header';
import {
  BooleanFilter,
  BranchFilter,
  FilterBar,
  LookupFilter,
  SearchFilter,
  SelectFilter,
} from '@/components/filter-bar/filter-bar';
import { useExports } from '@/components/providers/exports-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import { endpoints } from '@/lib/api/endpoints';
import { P } from '@/lib/auth/permissions';
import { useUrlFilters } from '@/lib/query/hooks';
import { MACHINE_STATUS_TONE } from '@/lib/theme/status-tone';

import { useExportMachinesView, useMachinesQuery } from '../hooks';
import { asText, downloadTextFile, toCsv } from '../lib/value';
import {
  FILTERABLE_MACHINE_STATUSES,
  HOLDER_TYPES,
  MACHINE_SORTABLE,
  type MachineListItem,
} from '../model';
import { BulkMaintenanceDialog } from './bulk-maintenance-dialog';

const filtersSchema = z.object({
  search: z.string().optional(),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  machineTypeId: z.string().optional(),
  machineModelId: z.string().optional(),
  holderType: z.string().optional(),
  holderId: z.string().optional(),
  branchId: z.string().optional(),
  warrantyExpiringBefore: z.string().optional(),
  minRepairCost: z.coerce.number().optional(),
  includeRetired: z.union([z.boolean(), z.string()]).optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

const defaults = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortDir: 'desc' as const,
};

function warrantyTone(daysRemaining: number, end: string | null): 'warning' | 'danger' | 'neutral' {
  if (!end) return 'neutral';
  if (daysRemaining <= 0) return 'danger';
  if (daysRemaining <= 30) return 'warning';
  return 'neutral';
}

export function MachinesListPage() {
  const t = useTranslations();
  const [filters, setFilters, reset] = useUrlFilters(filtersSchema, defaults);
  const { trackJob } = useExports();
  const exportMutation = useExportMachinesView();
  const [bulkMaintOpen, setBulkMaintOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<MachineListItem[]>([]);

  const includeRetired =
    filters.includeRetired === true || filters.includeRetired === 'true';

  const listParams = useMemo(
    () => ({
      page: filters.page,
      limit: filters.limit,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
      search: filters.search,
      status: filters.status,
      machineTypeId: filters.machineTypeId,
      machineModelId: filters.machineModelId,
      holderType: filters.holderType,
      holderId: filters.holderId,
      branchId: filters.branchId,
      warrantyExpiringBefore: filters.warrantyExpiringBefore,
      minRepairCost: filters.minRepairCost,
      includeRetired: includeRetired || undefined,
    }),
    [filters, includeRetired],
  );

  const query = useMachinesQuery(listParams);

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.machineTypeId ||
      filters.machineModelId ||
      filters.holderType ||
      filters.holderId ||
      filters.branchId ||
      filters.warrantyExpiringBefore ||
      filters.minRepairCost ||
      includeRetired,
  );

  const statusOptions = useMemo(
    () =>
      FILTERABLE_MACHINE_STATUSES.map((value) => ({
        value,
        label: t(`enums.machineStatus.${value}` as 'enums.machineStatus.UNKNOWN'),
      })),
    [t],
  );

  const holderOptions = useMemo(
    () =>
      HOLDER_TYPES.map((value) => ({
        value,
        label: t(`web.machines.holderType.${value}` as 'web.machines.holderType.FACTORY'),
      })),
    [t],
  );

  const columns = useMemo<DataTableColumn<MachineListItem>[]>(
    () => [
      {
        id: 'serial',
        accessorKey: 'serial',
        header: t('web.machines.serial'),
        meta: { label: t('web.machines.serial'), locked: true },
        cell: ({ row }) => <SerialText value={row.original.serial} />,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('web.machines.status'),
        meta: { label: t('web.machines.status') },
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <StatusChip
              status={status}
              tone={MACHINE_STATUS_TONE[status] ?? 'neutral'}
              label={t(`enums.machineStatus.${status}` as 'enums.machineStatus.UNKNOWN')}
            />
          );
        },
      },
      {
        id: 'model',
        accessorFn: (row) => row.model.name,
        enableSorting: false,
        header: t('web.machines.model'),
        meta: { label: t('web.machines.model') },
        cell: ({ row }) => row.original.model.name,
      },
      {
        id: 'type',
        accessorFn: (row) => row.type.name,
        enableSorting: false,
        header: t('web.machines.type'),
        meta: { label: t('web.machines.type') },
        cell: ({ row }) => row.original.type.name,
      },
      {
        id: 'holder',
        enableSorting: false,
        header: t('web.machines.holder'),
        meta: { label: t('web.machines.holder') },
        cell: ({ row }) => {
          const holder = row.original.holder;
          if (!holder) return '—';
          const typeLabel = t(
            `web.machines.holderType.${holder.type}` as 'web.machines.holderType.FACTORY',
          );
          const id = asText(holder.id);
          return <HolderChip type={holder.type} name={id ? `${typeLabel} · ${id.slice(0, 8)}` : typeLabel} />;
        },
      },
      {
        id: 'branch',
        enableSorting: false,
        header: t('web.machines.branch'),
        meta: { label: t('web.machines.branch') },
        cell: ({ row }) => row.original.branch?.name ?? '—',
      },
      {
        id: 'warrantyEnd',
        header: t('web.machines.warrantyEnd'),
        meta: { label: t('web.machines.warrantyEnd') },
        cell: ({ row }) => {
          const end = asText(row.original.warranty.end);
          const days = row.original.warranty.daysRemaining;
          const tone = warrantyTone(days, end);
          return (
            <span className={tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : undefined}>
              <DateText value={end} />
              {end && days > 0 && days <= 30 ? (
                <span className="ms-xs t-caption text-warning">
                  {t('web.machines.warrantyExpiring', { days })}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: 'totalRepairCost',
        enableSorting: true,
        header: t('web.machines.totalRepairCost'),
        meta: { label: t('web.machines.totalRepairCost') },
        cell: () => <Money value={null} />,
      },
      {
        id: 'repairCount',
        enableSorting: false,
        header: t('web.machines.repairCount'),
        meta: { label: t('web.machines.repairCount') },
        cell: () => <span className="text-text-secondary">—</span>,
      },
      {
        id: 'purchaseDate',
        enableSorting: false,
        header: t('web.machines.purchaseDate'),
        meta: { label: t('web.machines.purchaseDate') },
        cell: () => <span className="text-text-secondary">—</span>,
      },
      {
        id: 'createdAt',
        enableSorting: true,
        header: t('web.machines.createdAt'),
        meta: { label: t('web.machines.createdAt') },
        cell: () => <span className="text-text-secondary">—</span>,
      },
    ],
    [t],
  );

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  const exportSelected = (selected: MachineListItem[]) => {
    const csv = toCsv([
      [t('web.machines.serial'), t('web.machines.status'), t('web.machines.model'), t('web.machines.type')],
      ...selected.map((row) => [row.serial, row.status, row.model.name, row.type.name]),
    ]);
    downloadTextFile(`machines-selected-${Date.now()}.csv`, csv);
    toast.success(t('web.machines.exportSelectedDone', { count: selected.length }));
  };

  const exportView = async () => {
    try {
      const job = await exportMutation.mutateAsync(listParams);
      if (job?.id) {
        trackJob(job.id);
        toast.success(t('web.machines.exportStarted'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('web.errors.generic'));
    }
  };

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('web.machines.title')}
        subtitle={t('web.machines.subtitle')}
        actions={
          <>
            <Can perm={P.reportsExport}>
              <Button type="button" variant="outline" onClick={() => void exportView()}>
                {t('web.machines.exportView')}
              </Button>
            </Can>
            <Can perm={P.machinesImport}>
              <Link
                href="/machines/import"
                className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-2.5 t-body hover:bg-surface-alt"
              >
                {t('web.machines.bulkImport')}
              </Link>
            </Can>
            <Can perm={P.machinesCreate}>
              <Link
                href="/machines/new"
                className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 t-body text-primary-foreground hover:bg-primary/80"
              >
                {t('web.machines.new')}
              </Link>
            </Can>
          </>
        }
      />

      <FilterBar state={filters} onChange={setFilters} onReset={reset} storageKey="machines.views">
        <SearchFilter name="search" placeholder={t('web.machines.searchHint')} dir="auto" />
        <SelectFilter name="status" label={t('web.machines.status')} options={statusOptions} multiple />
        <LookupFilter
          name="machineTypeId"
          label={t('web.machines.type')}
          endpoint={endpoints.machineTypes.list}
        />
        <LookupFilter
          name="machineModelId"
          label={t('web.machines.model')}
          endpoint={endpoints.machineModels.list}
        />
        <SelectFilter name="holderType" label={t('web.machines.holderTypeLabel')} options={holderOptions} />
        {filters.holderType ? (
          <div className="min-w-[160px] space-y-xs">
            <label className="t-caption text-text-secondary" htmlFor="filter-holderId">
              {t('web.machines.holderId')}
            </label>
            <Input
              id="filter-holderId"
              dir="ltr"
              className="t-mono"
              value={typeof filters.holderId === 'string' ? filters.holderId : ''}
              onChange={(e) => setFilters({ holderId: e.target.value || undefined, page: 1 })}
              placeholder={t('web.machines.holderIdHint')}
            />
          </div>
        ) : null}
        <BranchFilter readAllPerm={P.machinesReadAll} />
        <div className="space-y-xs">
          <label className="t-caption text-text-secondary" htmlFor="filter-warrantyExpiringBefore">
            {t('web.machines.warrantyExpiringBefore')}
          </label>
          <Input
            id="filter-warrantyExpiringBefore"
            type="date"
            dir="ltr"
            className="t-mono"
            value={filters.warrantyExpiringBefore ?? ''}
            onChange={(e) =>
              setFilters({ warrantyExpiringBefore: e.target.value || undefined, page: 1 })
            }
          />
        </div>
        <div className="space-y-xs">
          <label className="t-caption text-text-secondary" htmlFor="filter-minRepairCost">
            {t('web.machines.minRepairCost')}
          </label>
          <Input
            id="filter-minRepairCost"
            type="number"
            dir="ltr"
            className="t-mono"
            min={0}
            value={filters.minRepairCost ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setFilters({
                minRepairCost: v === '' ? undefined : Number(v),
                page: 1,
              });
            }}
          />
        </div>
        <BooleanFilter name="includeRetired" label={t('web.machines.includeRetired')} />
      </FilterBar>

      <DataTable
        columns={columns}
        data={rows}
        meta={meta}
        state={filters}
        onStateChange={setFilters}
        sortableColumns={MACHINE_SORTABLE}
        isLoading={query.isLoading}
        isFetching={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
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
                : t('web.filters.emptyBody')
            }
          />
        }
        rowHref={(row) => `/machines/${row.id}`}
        columnVisibility={{ storageKey: 'machines.columns' }}
        density
        sticky={{ header: true, firstColumn: true }}
        getRowId={(row) => row.id}
        selection={{
          enabled: true,
          getRowId: (row) => row.id,
          bulkActions: [
            {
              id: 'export-selected',
              label: t('web.machines.exportSelected'),
              onClick: (selected) => exportSelected(selected),
            },
            {
              id: 'open-maintenance',
              label: t('web.machines.openMaintenanceSelected'),
              onClick: (selected) => {
                setSelectedRows(selected);
                setBulkMaintOpen(true);
              },
            },
          ],
        }}
      />

      <BulkMaintenanceDialog
        open={bulkMaintOpen}
        onOpenChange={setBulkMaintOpen}
        machines={selectedRows}
        onDone={() => void query.refetch()}
      />
    </div>
  );
}
