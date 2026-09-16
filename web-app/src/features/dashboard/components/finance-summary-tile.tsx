'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { Money } from '@/components/common/money';
import { useFinanceSummary } from '@/features/finance/hooks/use-finance';
import { resolvePeriodRange } from '@/features/finance/lib/period';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';

import { DashboardTile } from './dashboard-tile';

export function FinanceSummaryTile() {
  const t = useTranslations();
  const { permissions } = useSession();
  const allowed = can(permissions, P.financeRead);
  const range = useMemo(() => resolvePeriodRange('thisMonth'), []);
  const query = useFinanceSummary(
    { dateFrom: range.dateFrom, dateTo: range.dateTo, compareToPrevious: true },
    allowed,
  );

  if (!allowed) return null;

  const income = query.data?.income.total ?? 0;
  const expense = query.data?.expense.total ?? 0;
  const net = query.data?.net ?? 0;
  const isEmpty = !query.data || (income === 0 && expense === 0);

  return (
    <DashboardTile
      title={t('web.dashboard.financeSummary')}
      viewAllHref="/finance"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      isEmpty={isEmpty}
      emptyTitle={t('web.dashboard.noFinance')}
      emptyBody={t('web.dashboard.noFinanceBody')}
      emptyTone="neutral"
    >
      <dl className="grid gap-md sm:grid-cols-3">
        <div>
          <dt className="t-caption text-text-secondary">{t('web.dashboard.income')}</dt>
          <dd>
            <Link href="/finance/transactions?kind=INCOME" className="hover:underline">
              <Money value={income} className="t-h3" />
            </Link>
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.dashboard.expense')}</dt>
          <dd>
            <Link href="/finance/transactions?kind=EXPENSE" className="hover:underline">
              <Money value={expense} className="t-h3" />
            </Link>
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.dashboard.net')}</dt>
          <dd>
            <Link href="/finance" className="hover:underline">
              <Money value={net} className="t-h3" />
            </Link>
          </dd>
        </div>
      </dl>
    </DashboardTile>
  );
}
