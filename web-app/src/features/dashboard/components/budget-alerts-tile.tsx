'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { StatusChip } from '@/components/common/status-chip';
import { BudgetProgress } from '@/features/finance/components/budget-progress';
import { useBudgetsStatus } from '@/features/finance/hooks/use-finance';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { BUDGET_TONE } from '@/lib/theme/status-tone';

import { DashboardTile } from './dashboard-tile';

export function BudgetAlertsTile() {
  const t = useTranslations();
  const { permissions } = useSession();
  const allowed = can(permissions, P.financeBudgetsManage);
  const query = useBudgetsStatus({ limit: 20 }, allowed);

  const alerts = useMemo(
    () => (query.data ?? []).filter((row) => row.status === 'WARNING' || row.status === 'EXCEEDED'),
    [query.data],
  );

  if (!allowed) return null;

  return (
    <DashboardTile
      title={t('web.dashboard.budgetAlerts')}
      viewAllHref="/finance/budgets"
      count={alerts.length}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      isEmpty={alerts.length === 0}
      emptyTitle={t('web.dashboard.noBudgetAlerts')}
      emptyBody={t('web.dashboard.noBudgetAlertsBody')}
    >
      <ul className="space-y-md">
        {alerts.map((row) => (
          <li key={row.id} className="space-y-sm">
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <Link href={`/finance/budgets/${row.id}`} className="t-label hover:underline">
                {row.category.name}
              </Link>
              <StatusChip
                status={row.status}
                tone={BUDGET_TONE[row.status] ?? 'neutral'}
                label={t(`enums.budgetStatus.${row.status}` as 'enums.budgetStatus.UNKNOWN')}
              />
            </div>
            <BudgetProgress
              status={row}
              statusLabel={t(`enums.budgetStatus.${row.status}` as 'enums.budgetStatus.UNKNOWN')}
            />
          </li>
        ))}
      </ul>
    </DashboardTile>
  );
}
