'use client';

import { useTranslations } from 'next-intl';

import { SerialText } from '@/components/common/serial-text';
import { StatusChip } from '@/components/common/status-chip';
import { useReportQuery } from '@/features/reports/hooks/use-reports';
import { configBySlug } from '@/features/reports/model';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { MACHINE_STATUS_TONE } from '@/lib/theme/status-tone';

import { DashboardTile } from './dashboard-tile';

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function IdleMachinesTile() {
  const t = useTranslations();
  const { permissions } = useSession();
  const allowed = can(permissions, P.reportsMachines);
  const config = configBySlug('machines-idle');
  const query = useReportQuery(config, { days: 30, limit: 5 }, allowed);

  if (!allowed) return null;

  const rows = (query.data?.rows ?? []).slice(0, 5);
  const total = query.data?.rowCount ?? rows.length;

  return (
    <DashboardTile
      title={t('web.dashboard.idleMachines')}
      viewAllHref="/reports/machines-idle?days=30"
      count={total}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      isEmpty={rows.length === 0}
      emptyTitle={t('web.dashboard.noIdleMachines')}
      emptyBody={t('web.dashboard.noIdleMachinesBody')}
    >
      <ul className="divide-y divide-border">
        {rows.map((row, index) => {
          const id = asText(row.id);
          const serial = asText(row.serial) ?? '—';
          const status = asText(row.status);
          const idleDays = asNumber(row.idleDays) ?? asNumber(row.daysIdle);
          const href = id
            ? `/machines/${id}`
            : `/machines?search=${encodeURIComponent(serial)}`;
          return (
            <li key={id ?? `${serial}-${index}`} className="flex flex-wrap items-center justify-between gap-sm py-sm">
              <Link href={href} className="hover:underline">
                <SerialText value={serial} />
              </Link>
              <div className="flex flex-wrap items-center gap-xs">
                {status ? (
                  <StatusChip
                    status={status}
                    tone={MACHINE_STATUS_TONE[status] ?? 'neutral'}
                    label={t(`enums.machineStatus.${status}` as 'enums.machineStatus.UNKNOWN')}
                  />
                ) : null}
                {idleDays !== null ? (
                  <span className="t-caption t-mono text-text-secondary">
                    {t('web.dashboard.idleDays', { days: idleDays })}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardTile>
  );
}
