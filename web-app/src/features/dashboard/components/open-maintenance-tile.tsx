'use client';

import { useTranslations } from 'next-intl';

import { DateText } from '@/components/common/date-text';
import { SerialText } from '@/components/common/serial-text';
import { StatusChip } from '@/components/common/status-chip';
import { useMaintenanceList } from '@/features/maintenance/hooks/use-maintenance';
import { Link } from '@/i18n/navigation';
import { isPageMeta } from '@/lib/api/pagination';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { MAINTENANCE_STATUS_TONE } from '@/lib/theme/status-tone';

import { DashboardTile } from './dashboard-tile';

export function OpenMaintenanceTile() {
  const t = useTranslations();
  const { permissions } = useSession();
  const allowed = can(permissions, P.maintenanceRead);
  const query = useMaintenanceList({ status: 'OPEN', limit: 5, page: 1 }, allowed);

  if (!allowed) return null;

  const items = query.data?.data ?? [];
  const total = isPageMeta(query.data?.meta) ? query.data.meta.total : items.length;

  return (
    <DashboardTile
      title={t('web.dashboard.openMaintenance')}
      viewAllHref="/maintenance?status=OPEN"
      count={total}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      isEmpty={items.length === 0}
      emptyTitle={t('web.dashboard.noOpenMaintenance')}
      emptyBody={t('web.dashboard.noOpenMaintenanceBody')}
    >
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-sm py-sm">
            <div className="min-w-0">
              <Link href={`/maintenance/${item.id}`} className="t-mono t-label hover:underline">
                {item.referenceNo}
              </Link>
              <p className="t-caption text-text-secondary">
                <SerialText value={item.machine.serial} />
              </p>
            </div>
            <div className="flex flex-col items-end gap-xs">
              <StatusChip
                status={item.status}
                tone={MAINTENANCE_STATUS_TONE[item.status] ?? 'neutral'}
                label={t(`enums.maintenanceStatus.${item.status}` as 'enums.maintenanceStatus.UNKNOWN')}
              />
              <DateText
                value={item.createdAt}
                format="relative"
                className="t-caption text-text-secondary"
              />
            </div>
          </li>
        ))}
      </ul>
    </DashboardTile>
  );
}
