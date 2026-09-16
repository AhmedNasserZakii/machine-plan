'use client';

import { useTranslations } from 'next-intl';

import { DateText } from '@/components/common/date-text';
import { StatusChip } from '@/components/common/status-chip';
import { useViolationsList } from '@/features/violations/hooks/use-violations';
import { Link } from '@/i18n/navigation';
import { isPageMeta } from '@/lib/api/pagination';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { SEVERITY_TONE, VIOLATION_STATUS_TONE } from '@/lib/theme/status-tone';

import { DashboardTile } from './dashboard-tile';

export function OpenViolationsTile() {
  const t = useTranslations();
  const { permissions } = useSession();
  const allowed = can(permissions, P.violationsRead);
  const query = useViolationsList({ status: 'OPEN', limit: 5, page: 1 }, allowed);

  if (!allowed) return null;

  const items = query.data?.data ?? [];
  const total = isPageMeta(query.data?.meta) ? query.data.meta.total : items.length;

  return (
    <DashboardTile
      title={t('web.dashboard.openViolations')}
      viewAllHref="/violations?status=OPEN"
      count={total}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      isEmpty={items.length === 0}
      emptyTitle={t('web.dashboard.noOpenViolations')}
      emptyBody={t('web.dashboard.noOpenViolationsBody')}
    >
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-sm py-sm">
            <div className="min-w-0">
              <Link href={`/violations/${item.id}`} className="t-label hover:underline">
                {item.type.name}
              </Link>
              <p className="t-caption text-text-secondary">{item.user.fullName}</p>
            </div>
            <div className="flex flex-col items-end gap-xs">
              <div className="flex flex-wrap justify-end gap-xs">
                <StatusChip
                  status={item.severity}
                  tone={SEVERITY_TONE[item.severity] ?? 'neutral'}
                  label={t(`enums.violationSeverity.${item.severity}` as 'enums.violationSeverity.UNKNOWN')}
                />
                <StatusChip
                  status={item.status}
                  tone={VIOLATION_STATUS_TONE[item.status] ?? 'neutral'}
                  label={t(`enums.violationStatus.${item.status}` as 'enums.violationStatus.UNKNOWN')}
                />
              </div>
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
