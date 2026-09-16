'use client';

import { useTranslations } from 'next-intl';

import { SerialText } from '@/components/common/serial-text';
import { StatusChip } from '@/components/common/status-chip';
import { useDecommissionCandidates } from '@/features/maintenance/hooks/use-maintenance';
import { asNumber } from '@/features/maintenance/lib/value';
import { Link } from '@/i18n/navigation';
import { isPageMeta } from '@/lib/api/pagination';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';

import { DashboardTile } from './dashboard-tile';

export function DecommissionCandidatesTile() {
  const t = useTranslations();
  const { permissions } = useSession();
  const allowed = can(permissions, P.machinesDecommission);
  const query = useDecommissionCandidates({ page: 1, limit: 5 }, allowed);

  if (!allowed) return null;

  const items = query.data?.data ?? [];
  const total = isPageMeta(query.data?.meta) ? query.data.meta.total : items.length;

  return (
    <DashboardTile
      title={t('web.dashboard.decommissionCandidates')}
      viewAllHref="/maintenance/decommissions?tab=candidates"
      count={total}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      isEmpty={items.length === 0}
      emptyTitle={t('web.dashboard.noDecommissionCandidates')}
      emptyBody={t('web.dashboard.noDecommissionCandidatesBody')}
    >
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const ratio = asNumber(item.costRatio);
          return (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-sm py-sm">
              <Link href={`/machines/${item.id}`} className="hover:underline">
                <SerialText value={item.serial} />
              </Link>
              <div className="flex flex-wrap items-center gap-xs">
                <StatusChip
                  tone={
                    item.recommendation === 'CONSIDER_DECOMMISSION'
                      ? 'danger'
                      : item.recommendation === 'REVIEW'
                        ? 'warning'
                        : 'success'
                  }
                  label={t(
                    `web.dashboard.recommendation.${item.recommendation}` as 'web.dashboard.recommendation.REVIEW',
                  )}
                />
                {ratio !== null ? (
                  <span className="t-caption t-mono text-text-secondary" dir="ltr">
                    {Math.round(ratio <= 1 ? ratio * 100 : ratio)}%
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
