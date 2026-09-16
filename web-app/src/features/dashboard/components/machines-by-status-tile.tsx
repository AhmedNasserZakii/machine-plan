'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { StatusChip } from '@/components/common/status-chip';
import { useReportQuery } from '@/features/reports/hooks/use-reports';
import { configBySlug } from '@/features/reports/model';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { MACHINE_STATUS_TONE } from '@/lib/theme/status-tone';

import { DashboardTile } from './dashboard-tile';

export function MachinesByStatusTile() {
  const t = useTranslations();
  const { permissions } = useSession();
  const allowed = can(permissions, P.machinesRead);
  const config = configBySlug('machines-inventory');
  const query = useReportQuery(config, { limit: 500 }, allowed);

  const byStatus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of query.data?.rows ?? []) {
      const status = typeof row.status === 'string' ? row.status : null;
      if (!status) continue;
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [query.data?.rows]);

  const total = byStatus.reduce((sum, [, n]) => sum + n, 0);

  if (!allowed) return null;

  return (
    <DashboardTile
      title={t('web.dashboard.machinesByStatus')}
      viewAllHref="/machines"
      count={total}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      isEmpty={byStatus.length === 0}
      emptyTitle={t('web.dashboard.noMachines')}
      emptyBody={t('web.dashboard.noMachinesBody')}
      emptyTone="neutral"
    >
      <ul className="space-y-sm">
        {byStatus.map(([status, count]) => (
          <li key={status} className="flex items-center justify-between gap-sm">
            <StatusChip
              status={status}
              tone={MACHINE_STATUS_TONE[status] ?? 'neutral'}
              label={t(`enums.machineStatus.${status}` as 'enums.machineStatus.UNKNOWN')}
            />
            <Link
              href={`/machines?status=${encodeURIComponent(status)}`}
              className="t-mono t-label text-primary hover:underline"
            >
              {count}
            </Link>
          </li>
        ))}
      </ul>
    </DashboardTile>
  );
}
