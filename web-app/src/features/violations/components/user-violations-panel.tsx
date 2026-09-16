'use client';

import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Circle,
  Eye,
  Minus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { DateText } from '@/components/common/date-text';
import { Money } from '@/components/common/money';
import { StatusChip } from '@/components/common/status-chip';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { SEVERITY_TONE, VIOLATION_STATUS_TONE } from '@/lib/theme/status-tone';

import { useUserViolations,useUserViolationSummary } from '../hooks/use-violations';
import {
  asNumber,
  type Violation,
  type ViolationSeverity,
  type ViolationStatus,
  type ViolationTrend,
} from '../model/types';

const STATUS_ICON: Record<ViolationStatus, LucideIcon> = {
  OPEN: AlertCircle,
  ACKNOWLEDGED: Eye,
  WAIVED: Ban,
  CHARGED: Wallet,
  CLOSED: CheckCircle2,
};

const TREND_ICON: Record<ViolationTrend, LucideIcon> = {
  IMPROVING: TrendingDown,
  STEADY: Minus,
  WORSENING: TrendingUp,
};

type UserViolationsPanelProps = {
  userId: string;
};

export function UserViolationsPanel({ userId }: UserViolationsPanelProps) {
  const t = useTranslations();
  const { permissions } = useSession();
  const summary = useUserViolationSummary(userId);
  const list = useUserViolations(userId, { page: 1, limit: 20, sortDir: 'desc' });
  const canSeeMoney = can(permissions, P.financeRead);

  const columns = useMemo<DataTableColumn<Violation>[]>(
    () => [
      {
        id: 'type',
        header: t('web.violations.type'),
        meta: { label: t('web.violations.type'), locked: true },
        cell: ({ row }) => row.original.type.name,
      },
      {
        id: 'severity',
        header: t('web.violations.severity'),
        meta: { label: t('web.violations.severity') },
        cell: ({ row }) => (
          <StatusChip
            status={row.original.severity}
            tone={SEVERITY_TONE[row.original.severity] ?? 'neutral'}
            label={t(`enums.severity.${row.original.severity}` as 'enums.severity.UNKNOWN')}
          />
        ),
      },
      {
        id: 'status',
        header: t('web.violations.status'),
        meta: { label: t('web.violations.status') },
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <StatusChip
              status={status}
              tone={VIOLATION_STATUS_TONE[status] ?? 'neutral'}
              icon={STATUS_ICON[status] ?? Circle}
              label={t(`enums.violationStatus.${status}` as 'enums.violationStatus.UNKNOWN')}
            />
          );
        },
      },
      {
        id: 'createdAt',
        header: t('web.violations.createdAt'),
        meta: { label: t('web.violations.createdAt') },
        cell: ({ row }) => <DateText value={row.original.createdAt} format="datetime" />,
      },
      ...(canSeeMoney
        ? ([
            {
              id: 'amount',
              header: t('web.violations.amount'),
              meta: { label: t('web.violations.amount') },
              cell: ({ row }: { row: { original: Violation } }) => (
                <Money value={asNumber(row.original.chargedAmount)} />
              ),
            },
          ] as DataTableColumn<Violation>[])
        : []),
    ],
    [canSeeMoney, t],
  );

  if (summary.isLoading || list.isLoading) return <TableSkeleton rows={6} />;
  if (summary.error) {
    return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  }
  if (list.error) {
    return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  }

  const data = summary.data;
  const TrendIcon = data ? TREND_ICON[data.trend] ?? Circle : Circle;
  const trendLabel = data
    ? t(
        `shared.violation_trend_${data.trend.toLowerCase()}` as 'shared.violation_trend_steady',
      )
    : '';

  const lastSix = (data?.last12Months ?? []).slice(-6);

  return (
    <div className="space-y-lg">
      {data ? (
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-border p-md">
            <p className="t-caption text-text-secondary">{t('shared.violation_summary_open')}</p>
            <p className="t-h3">{data.totals.open}</p>
          </div>
          <div className="rounded-md border border-border p-md">
            <p className="t-caption text-text-secondary">{t('shared.violation_summary_charged')}</p>
            <p className="t-h3">{data.totals.charged}</p>
          </div>
          <div className="rounded-md border border-border p-md">
            <p className="t-caption text-text-secondary">{t('shared.violation_summary_waived')}</p>
            <p className="t-h3">{data.totals.waived}</p>
          </div>
          <div className="rounded-md border border-border p-md">
            <p className="t-caption text-text-secondary">{t('shared.violation_summary_total')}</p>
            {canSeeMoney ? (
              <Money value={data.totalCharged} className="t-h3" />
            ) : (
              <p className="t-h3 text-text-secondary">{t('web.common.moneyHidden')}</p>
            )}
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="space-y-sm rounded-md border border-border p-md">
          <div className="flex flex-wrap items-center gap-sm">
            <p className="t-label">{t('shared.violation_summary_trend')}</p>
            <span className="inline-flex items-center gap-xs t-body">
              <TrendIcon className="size-4" aria-hidden />
              {trendLabel}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-xs">
            {lastSix.map((row) => (
              <div key={row.month} className="text-center">
                <div
                  className="mx-auto w-full rounded-sm bg-info-surface"
                  style={{ height: `${Math.max(8, Math.min(64, row.count * 12))}px` }}
                  title={`${row.month}: ${row.count}`}
                />
                <p className="mt-xs t-caption text-text-secondary t-mono">{row.month.slice(5)}</p>
              </div>
            ))}
          </div>
          {(Object.entries(data.bySeverity ?? {}) as [ViolationSeverity, number][]).length > 0 ? (
            <div className="flex flex-wrap gap-sm pt-sm">
              {(['LOW', 'MEDIUM', 'HIGH'] as const).map((sev) => {
                const count =
                  typeof (data.bySeverity as Record<string, number> | undefined)?.[sev] === 'number'
                    ? (data.bySeverity as Record<string, number>)[sev]
                    : 0;
                return (
                  <StatusChip
                    key={sev}
                    status={sev}
                    tone={SEVERITY_TONE[sev] ?? 'neutral'}
                    label={`${t(`enums.severity.${sev}`)} · ${count}`}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        meta={list.data?.meta}
        state={{ page: 1, limit: 20 }}
        onStateChange={() => undefined}
        isLoading={false}
        isFetching={list.isFetching && !list.isLoading}
        error={null}
        emptyState={
          <EmptyState
            title={t('shared.violations_empty_title')}
            description={t('shared.violations_empty_subtitle')}
          />
        }
        rowHref={(row) => `/violations/${row.id}`}
        selection={{ enabled: false }}
      />
    </div>
  );
}
