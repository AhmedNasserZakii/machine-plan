'use client';

import { useTranslations } from 'next-intl';

import { DateText } from '@/components/common/date-text';
import { SerialText } from '@/components/common/serial-text';
import { useReportQuery } from '@/features/reports/hooks/use-reports';
import { configBySlug } from '@/features/reports/model';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';

import { DashboardTile } from './dashboard-tile';

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function WarrantyExpiringTile() {
  const t = useTranslations();
  const { permissions } = useSession();
  const allowed = can(permissions, P.reportsMachines);
  const config = configBySlug('machines-warranty');
  const query = useReportQuery(config, { days: 30, limit: 5 }, allowed);

  if (!allowed) return null;

  const rows = (query.data?.rows ?? []).slice(0, 5);
  const total = query.data?.rowCount ?? rows.length;

  return (
    <DashboardTile
      title={t('web.dashboard.warrantyExpiring')}
      viewAllHref="/reports/machines-warranty?days=30"
      count={total}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      isEmpty={rows.length === 0}
      emptyTitle={t('web.dashboard.noWarrantyExpiring')}
      emptyBody={t('web.dashboard.noWarrantyExpiringBody')}
    >
      <ul className="divide-y divide-border">
        {rows.map((row, index) => {
          const id = asText(row.id);
          const serial = asText(row.serial) ?? '—';
          const warrantyEnd = asText(row.warrantyEnd);
          const daysRemaining = typeof row.daysRemaining === 'number' ? row.daysRemaining : null;
          const href = id
            ? `/machines/${id}`
            : `/machines?search=${encodeURIComponent(serial)}`;
          return (
            <li key={id ?? `${serial}-${index}`} className="flex items-center justify-between gap-sm py-sm">
              <Link href={href} className="hover:underline">
                <SerialText value={serial} />
              </Link>
              <div className="flex flex-col items-end gap-xs">
                {warrantyEnd ? (
                  <DateText value={warrantyEnd} className="t-caption text-text-secondary" />
                ) : (
                  <span className="t-caption text-text-secondary">—</span>
                )}
                {daysRemaining !== null ? (
                  <span className="t-caption t-mono text-text-secondary" dir="ltr">
                    {t('web.machines.warrantyExpiring', { days: daysRemaining })}
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
