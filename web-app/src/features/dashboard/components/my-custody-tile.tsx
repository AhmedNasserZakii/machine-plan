'use client';

import { useTranslations } from 'next-intl';

import { useUserCustody } from '@/features/users/hooks/use-users';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';

import { DashboardTile } from './dashboard-tile';

export function MyCustodyTile() {
  const t = useTranslations();
  const { user, permissions } = useSession();
  const allowed = can(permissions, P.machinesRead);
  const userId = user?.id ?? '';
  const query = useUserCustody(userId, { page: 1, limit: 5 }, allowed && Boolean(userId));

  if (!allowed || !userId) return null;

  const summary = query.data?.summary;
  const total = summary?.totalMachines ?? 0;

  return (
    <DashboardTile
      title={t('web.dashboard.myCustody')}
      viewAllHref={`/users/${userId}`}
      count={total}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      isEmpty={total === 0}
      emptyTitle={t('web.dashboard.noCustody')}
      emptyBody={t('web.dashboard.noCustodyBody')}
      emptyTone="success"
    >
      <dl className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <div>
          <dt className="t-caption text-text-secondary">{t('web.dashboard.custodyTotal')}</dt>
          <dd>
            <Link href={`/users/${userId}`} className="t-h3 t-mono text-primary hover:underline">
              {summary?.totalMachines ?? 0}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.dashboard.custodyInHand')}</dt>
          <dd className="t-h3 t-mono">{summary?.inHand ?? 0}</dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.dashboard.custodyWithMerchants')}</dt>
          <dd className="t-h3 t-mono">{summary?.withMerchants ?? 0}</dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.dashboard.custodyOpenViolations')}</dt>
          <dd className="t-h3 t-mono">{summary?.openViolations ?? 0}</dd>
        </div>
      </dl>
    </DashboardTile>
  );
}
