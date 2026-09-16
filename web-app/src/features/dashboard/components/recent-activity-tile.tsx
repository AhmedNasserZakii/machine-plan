'use client';

import { useTranslations } from 'next-intl';

import { DateText } from '@/components/common/date-text';
import { useAuditList } from '@/features/audit/hooks/use-audit';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';

import { DashboardTile } from './dashboard-tile';

export function RecentActivityTile() {
  const t = useTranslations();
  const { permissions } = useSession();
  const allowed = can(permissions, P.auditRead);
  const query = useAuditList({ limit: 10 }, allowed);

  if (!allowed) return null;

  const items = query.data ?? [];

  return (
    <DashboardTile
      title={t('web.dashboard.recentActivity')}
      viewAllHref="/audit"
      count={items.length}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      isEmpty={items.length === 0}
      emptyTitle={t('web.dashboard.noRecentActivity')}
      emptyBody={t('web.dashboard.noRecentActivityBody')}
      emptyTone="neutral"
    >
      <ul className="divide-y divide-border">
        {items.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-sm py-sm">
            <span className="t-label">
              {t(`enums.auditAction.${row.action}` as 'enums.auditAction.LOGIN_SUCCESS')}
            </span>
            <DateText
              value={row.createdAt}
              format="relative"
              className="t-caption text-text-secondary"
            />
          </li>
        ))}
      </ul>
    </DashboardTile>
  );
}
