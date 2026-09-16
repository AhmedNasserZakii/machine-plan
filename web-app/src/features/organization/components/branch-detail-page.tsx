'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { Money } from '@/components/common/money';
import { StatusChip } from '@/components/common/status-chip';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';

import {
  useActivateBranchMutation,
  useBranchDetail,
  useBranchSummary,
  useDeactivateBranchMutation,
} from '../hooks';

export function BranchDetailPage({ id }: { id: string }) {
  const t = useTranslations();
  const { permissions } = useSession();
  const detail = useBranchDetail(id);
  const summary = useBranchSummary(id);
  const activate = useActivateBranchMutation(id);
  const deactivate = useDeactivateBranchMutation(id);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  if (detail.isLoading) return <DetailSkeleton />;
  if (detail.error || !detail.data) {
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  }

  const branch = detail.data;
  const s = summary.data;

  return (
    <div className="space-y-lg">
      <PageHeader
        title={branch.name}
        subtitle={branch.code}
        status={
          <StatusChip
            status={branch.isActive ? 'ACTIVE' : 'INACTIVE'}
            tone={branch.isActive ? 'success' : 'neutral'}
            label={branch.isActive ? t('web.users.active') : t('web.users.inactive')}
          />
        }
        actions={
          <Can perm={P.branchesManage}>
            {branch.isActive ? (
              <Button type="button" variant="destructive" onClick={() => setConfirmDeactivate(true)}>
                {t('web.organization.deactivate')}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={async () => {
                  try {
                    await activate.mutateAsync();
                    toast.success(t('web.organization.activated'));
                  } catch (error) {
                    toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
                  }
                }}
              >
                {t('web.organization.activate')}
              </Button>
            )}
          </Can>
        }
      />

      {summary.isLoading ? (
        <DetailSkeleton />
      ) : summary.error ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : s ? (
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-border p-md">
            <p className="t-caption text-text-secondary">{t('web.organization.machinesTotal')}</p>
            <p className="t-h2">{s.machines.total}</p>
          </div>
          <div className="rounded-md border border-border p-md">
            <p className="t-caption text-text-secondary">{t('web.organization.staff')}</p>
            <p className="t-h2">
              {s.staff.supervisors + s.staff.representatives}
            </p>
            <p className="t-caption text-text-secondary">
              {t('web.organization.staffBreakdown', {
                supervisors: s.staff.supervisors,
                representatives: s.staff.representatives,
              })}
            </p>
          </div>
          <div className="rounded-md border border-border p-md">
            <p className="t-caption text-text-secondary">{t('web.organization.openViolations')}</p>
            <p className="t-h2">{s.openViolations}</p>
          </div>
          {can(permissions, P.financeRead) && s.finance ? (
            <div className="rounded-md border border-border p-md">
              <p className="t-caption text-text-secondary">{t('web.organization.monthFinance')}</p>
              <p className="t-body">
                {t('web.organization.income')}: <Money value={s.finance.monthIncome} />
              </p>
              <p className="t-body">
                {t('web.organization.expenses')}: <Money value={s.finance.monthExpenses} />
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        title={t('web.organization.deactivateTitle')}
        description={t('web.organization.deactivateBody')}
        confirmLabel={t('web.organization.deactivate')}
        destructive
        pending={deactivate.isPending}
        onConfirm={async () => {
          try {
            await deactivate.mutateAsync();
            toast.success(t('web.organization.deactivated'));
            setConfirmDeactivate(false);
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
          }
        }}
      />
    </div>
  );
}
