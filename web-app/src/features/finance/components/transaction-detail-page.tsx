'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Can } from '@/components/common/can';
import { DateText } from '@/components/common/date-text';
import { Money } from '@/components/common/money';
import { StatusChip } from '@/components/common/status-chip';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { AuditSection } from '@/features/audit/components';
import { Link } from '@/i18n/navigation';
import { P } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';

import { useTransactionDetail } from '../hooks';
import { sourceOriginHref } from '../lib/categories';
import { asText } from '../lib/value';
import { TransactionVoidDialog } from './transaction-void-dialog';

type TransactionDetailPageProps = {
  id: string;
};

export function TransactionDetailPage({ id }: TransactionDetailPageProps) {
  const t = useTranslations();
  const query = useTransactionDetail(id);
  const [voidOpen, setVoidOpen] = useState(false);
  const tx = query.data;

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  if (!tx && query.isLoading) {
    return <DetailSkeleton />;
  }

  if (!tx) {
    return <ErrorState error={new Error('Not found')} onRetry={() => void query.refetch()} />;
  }

  const originHref = sourceOriginHref(asText(tx.sourceRefType), asText(tx.sourceRefId));
  const isAuto = tx.source !== 'MANUAL';
  const voidReason = asText(tx.voidReason);

  return (
    <div className="space-y-md">
      <PageHeader
        title={tx.referenceNo}
        subtitle={tx.category.path || tx.category.name}
        status={
          tx.isVoided ? (
            <StatusChip status="VOIDED" tone="neutral" label={t('shared.finance_voided')} />
          ) : (
            <StatusChip
              status={tx.kind}
              tone={tx.kind === 'INCOME' ? 'success' : 'danger'}
              label={
                tx.kind === 'INCOME' ? t('shared.finance_income') : t('shared.finance_expense')
              }
            />
          )
        }
        actions={
          <>
            {tx.isEditable ? (
              <Can perm={P.financeUpdate}>
                <Link
                  href={`/finance/transactions/${tx.id}/edit`}
                  className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-2.5 t-body hover:bg-surface-alt"
                >
                  {t('shared.finance_edit_transaction')}
                </Link>
              </Can>
            ) : null}
            {tx.isVoidable ? (
              <Can perm={P.financeVoid}>
                <Button type="button" variant="destructive" onClick={() => setVoidOpen(true)}>
                  {t('shared.finance_void_transaction')}
                </Button>
              </Can>
            ) : null}
          </>
        }
      />

      {isAuto ? (
        <div
          role="status"
          className="rounded-md border border-info bg-info-surface px-md py-sm t-body text-info"
        >
          <p>{t('shared.finance_auto_generated_banner')}</p>
          {originHref ? (
            <Link href={originHref} className="mt-xs inline-block font-medium underline">
              {t('web.finance.openSource', {
                source: t(`web.finance.source.${tx.source}` as 'web.finance.source.MANUAL'),
              })}
            </Link>
          ) : null}
        </div>
      ) : null}

      {tx.isVoided ? (
        <div role="status" className="rounded-md border border-border bg-neutral-surface px-md py-sm">
          <p className="t-body">
            {t('web.finance.voidedReason', { reason: voidReason ?? '—' })}
          </p>
          <p className="t-caption text-text-secondary">
            <DateText value={asText(tx.voidedAt)} format="datetime" />
          </p>
        </div>
      ) : null}

      <dl className="grid gap-md rounded-md border border-border bg-surface p-md sm:grid-cols-2">
        <div>
          <dt className="t-caption text-text-secondary">{t('shared.finance_amount')}</dt>
          <dd>
            <Money
              value={tx.kind === 'EXPENSE' ? -tx.amount : tx.amount}
              className={cn(
                't-h2',
                tx.isVoided && 'line-through opacity-60',
                tx.kind === 'INCOME' ? 'text-success' : 'text-danger',
              )}
            />
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('shared.finance_date')}</dt>
          <dd>
            <DateText value={tx.transactionDate} />
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('shared.finance_payment_method')}</dt>
          <dd>{tx.paymentMethod.name}</dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('shared.finance_source')}</dt>
          <dd>
            <StatusChip
              status={tx.source}
              tone={isAuto ? 'info' : 'neutral'}
              label={t(`web.finance.source.${tx.source}` as 'web.finance.source.MANUAL')}
            />
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('shared.finance_scope')}</dt>
          <dd>{tx.branch?.name ?? t('shared.finance_company')}</dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('shared.finance_supplier')}</dt>
          <dd>{tx.supplier?.name ?? t('shared.finance_none')}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="t-caption text-text-secondary">{t('shared.finance_notes')}</dt>
          <dd className="whitespace-pre-wrap">{asText(tx.notes) ?? '—'}</dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.finance.createdAt')}</dt>
          <dd>
            <DateText value={tx.createdAt} format="datetime" />
          </dd>
        </div>
      </dl>

      <AuditSection entityType="finance_transaction" entityId={tx.id} />

      <TransactionVoidDialog
        transactionId={tx.id}
        open={voidOpen}
        onOpenChange={setVoidOpen}
        onAlreadyVoided={() => {
          setVoidOpen(false);
          void query.refetch();
        }}
      />
    </div>
  );
}
