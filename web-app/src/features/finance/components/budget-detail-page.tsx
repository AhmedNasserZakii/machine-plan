'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { DateText } from '@/components/common/date-text';
import { Money } from '@/components/common/money';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import { P } from '@/lib/auth/permissions';

import { useBudgetDetail, useBudgetsStatus, useDeleteBudgetMutation } from '../hooks';
import { BudgetProgress } from './budget-progress';

type BudgetDetailPageProps = {
  id: string;
};

export function BudgetDetailPage({ id }: BudgetDetailPageProps) {
  const t = useTranslations();
  const router = useRouter();
  const query = useBudgetDetail(id);
  const statusQuery = useBudgetsStatus({ limit: 100 });
  const deleteMutation = useDeleteBudgetMutation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const status = useMemo(
    () => (statusQuery.data ?? []).find((row) => row.id === id),
    [statusQuery.data, id],
  );

  const budget = query.data;

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!budget && query.isLoading) return <DetailSkeleton />;
  if (!budget) {
    return <ErrorState error={new Error('Not found')} onRetry={() => void query.refetch()} />;
  }

  const onDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: budget.id });
      toast.success(t('web.finance.budgetDeleted'));
      router.push('/finance/budgets');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('web.errors.generic'));
    }
  };

  return (
    <div className="space-y-md">
      <PageHeader
        title={budget.category.path || budget.category.name}
        subtitle={t(`enums.budgetPeriod.${budget.periodType}` as 'enums.budgetPeriod.MONTHLY')}
        actions={
          <Can perm={P.financeBudgetsManage}>
            <Link
              href={`/finance/budgets/${budget.id}/edit`}
              className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-2.5 t-body hover:bg-surface-alt"
            >
              {t('shared.finance_edit_budget')}
            </Link>
            <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
              {t('web.finance.deleteBudget')}
            </Button>
          </Can>
        }
      />

      <dl className="grid gap-md rounded-md border border-border bg-surface p-md sm:grid-cols-2">
        <div>
          <dt className="t-caption text-text-secondary">{t('shared.finance_budget_amount')}</dt>
          <dd>
            <Money value={budget.amount} className="t-h2" />
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('shared.finance_period')}</dt>
          <dd dir="ltr">
            <DateText value={budget.periodStart} /> → <DateText value={budget.periodEnd} />
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('shared.finance_scope')}</dt>
          <dd>{budget.branch?.name ?? t('shared.finance_company')}</dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('shared.finance_warning_threshold')}</dt>
          <dd className="t-mono" dir="ltr">
            {budget.alertThresholdPercent}%
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('shared.finance_include_subcategories')}</dt>
          <dd>{budget.includeSubcategories ? t('web.common.yes') : t('web.common.no')}</dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('shared.finance_auto_renew')}</dt>
          <dd>{budget.autoRenew ? t('web.common.yes') : t('web.common.no')}</dd>
        </div>
      </dl>

      {status ? (
        <section className="rounded-md border border-border bg-surface p-md">
          <h2 className="mb-sm t-h3">{t('web.finance.progress')}</h2>
          <BudgetProgress
            status={status}
            statusLabel={t(`enums.budgetStatus.${status.status}` as 'enums.budgetStatus.OK')}
          />
          <p className="mt-sm t-caption text-text-secondary">
            {t('web.finance.paceHint', {
              expected: status.pace.expectedSpendByNow,
              projected: status.pace.projectedTotal,
            })}
          </p>
        </section>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('shared.finance_delete_budget_title')}
        description={t('shared.finance_delete_budget_body')}
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
