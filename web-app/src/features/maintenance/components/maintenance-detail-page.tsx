'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { DateText } from '@/components/common/date-text';
import { Money } from '@/components/common/money';
import { SerialText } from '@/components/common/serial-text';
import { StatusChip } from '@/components/common/status-chip';
import { DetailPageScaffold } from '@/components/detail/detail-page-scaffold';
import { ErrorState } from '@/components/feedback/error-state';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { MAINTENANCE_STATUS_TONE } from '@/lib/theme/status-tone';
import { cn } from '@/lib/utils';

import { useMaintenanceDetail } from '../hooks';
import { asNumber, asText } from '../lib/value';
import { MAINTENANCE_STEPPER, type MaintenanceStatus } from '../model';
import { CancelOrderDialog } from './cancel-order-dialog';
import { CloseOrderDialog } from './close-order-dialog';
import { SendReceiveDialog } from './send-receive-dialog';

export function MaintenanceDetailPage({ id }: { id: string }) {
  const t = useTranslations();
  const { permissions } = useSession();
  const detail = useMaintenanceDetail(id);
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const order = detail.data;
  const canSeeMoney = can(permissions, P.financeRead);
  const canUpdate = can(permissions, P.maintenanceUpdate);
  const canClose =
    can(permissions, P.maintenanceClose) && can(permissions, P.maintenanceSetCost);

  if (detail.isLoading) return <DetailSkeleton />;
  if (detail.error || !order) {
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  }

  const status = order.status;
  const showSend = status === 'OPEN' && canUpdate;
  const showReceive = status === 'IN_PROGRESS' && canUpdate;
  const showClose = status === 'RETURNED' && canClose;
  const showCancel =
    (status === 'OPEN' || status === 'IN_PROGRESS') && canUpdate;

  const stepIndex = (s: MaintenanceStatus) => {
    if (s === 'CANCELLED') return -1;
    return MAINTENANCE_STEPPER.indexOf(s);
  };
  const currentStep = stepIndex(status);

  return (
    <>
      <DetailPageScaffold
        title={<span className="t-mono">{order.referenceNo}</span>}
        subtitle={
          <Link href={`/machines/${order.machine.id}`} className="hover:underline">
            <SerialText value={order.machine.serial} />
          </Link>
        }
        status={
          <StatusChip
            status={status}
            tone={MAINTENANCE_STATUS_TONE[status] ?? 'neutral'}
            label={t(`enums.maintenanceStatus.${status}` as 'enums.maintenanceStatus.UNKNOWN')}
          />
        }
        actions={
          <div className="flex flex-wrap gap-sm">
            {showSend ? (
              <Button type="button" onClick={() => setSendOpen(true)}>
                {t('web.maintenance.send')}
              </Button>
            ) : null}
            {showReceive ? (
              <Button type="button" onClick={() => setReceiveOpen(true)}>
                {t('web.maintenance.receive')}
              </Button>
            ) : null}
            {showClose ? (
              <Button type="button" onClick={() => setCloseOpen(true)}>
                {t('web.maintenance.close')}
              </Button>
            ) : null}
            {showCancel ? (
              <Button type="button" variant="destructive" onClick={() => setCancelOpen(true)}>
                {t('web.maintenance.cancel')}
              </Button>
            ) : null}
          </div>
        }
        summary={
          <dl className="space-y-md">
            <div>
              <dt className="t-caption text-text-secondary">{t('web.maintenance.location')}</dt>
              <dd>{order.location.name}</dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('web.maintenance.sentAt')}</dt>
              <dd>
                <DateText value={order.sentAt} format="datetime" />
              </dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('web.maintenance.returnedAt')}</dt>
              <dd>
                <DateText
                  value={typeof order.returnedAt === 'string' ? order.returnedAt : null}
                  format="datetime"
                />
              </dd>
            </div>
            <div>
              <dt className="t-caption text-text-secondary">{t('web.maintenance.cost')}</dt>
              <dd>
                {canSeeMoney ? <Money value={asNumber(order.cost)} /> : t('web.common.moneyHidden')}
              </dd>
            </div>
            {asText(order.financeTransactionId) ? (
              <div>
                <dt className="t-caption text-text-secondary">{t('web.maintenance.financeLink')}</dt>
                <dd>
                  <Link
                    href={`/finance?transactionId=${asText(order.financeTransactionId)}`}
                    className="text-primary hover:underline"
                  >
                    {t('web.maintenance.viewTransaction')}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
        }
        defaultTab="overview"
        tabs={[
          {
            id: 'overview',
            label: t('web.maintenance.tabOverview'),
            content: (
              <div className="space-y-lg">
                {status !== 'CANCELLED' ? (
                  <ol className="flex flex-wrap gap-sm" aria-label={t('web.maintenance.stepper')}>
                    {MAINTENANCE_STEPPER.map((step, index) => {
                      const done = currentStep > index || (currentStep === index && status === 'CLOSED');
                      const active = currentStep === index && status !== 'CLOSED';
                      return (
                        <li
                          key={step}
                          className={cn(
                            'rounded-lg border px-md py-sm t-caption',
                            active
                              ? 'border-primary bg-primary/10 text-primary'
                              : done
                                ? 'border-success text-success'
                                : 'border-border text-text-secondary',
                          )}
                        >
                          {t(`enums.maintenanceStatus.${step}` as 'enums.maintenanceStatus.UNKNOWN')}
                        </li>
                      );
                    })}
                  </ol>
                ) : null}

                <div className="space-y-md rounded-md border border-border bg-surface p-md">
                  <dl className="grid gap-md sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <dt className="t-caption text-text-secondary">
                        {t('web.maintenance.reportedFault')}
                      </dt>
                      <dd className="whitespace-pre-wrap">{order.reportedFault}</dd>
                    </div>
                    <div>
                      <dt className="t-caption text-text-secondary">{t('web.maintenance.resultLabel')}</dt>
                      <dd>
                        {order.result
                          ? t(
                              `web.maintenance.result.${order.result}` as 'web.maintenance.result.REPAIRED',
                            )
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="t-caption text-text-secondary">
                        {t('web.maintenance.responsibleParty')}
                      </dt>
                      <dd>
                        {order.responsibleParty
                          ? t(
                              `web.maintenance.party.${order.responsibleParty}` as 'web.maintenance.party.COMPANY',
                            )
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="t-caption text-text-secondary">
                        {t('web.maintenance.performedBy')}
                      </dt>
                      <dd>{asText(order.performedByName) ?? '—'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="t-caption text-text-secondary">{t('web.maintenance.notes')}</dt>
                      <dd className="whitespace-pre-wrap">{asText(order.notes) ?? '—'}</dd>
                    </div>
                    {asText(order.cancelReason) ? (
                      <div className="sm:col-span-2">
                        <dt className="t-caption text-text-secondary">
                          {t('web.maintenance.cancelReason')}
                        </dt>
                        <dd>{asText(order.cancelReason)}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              </div>
            ),
          },
        ]}
      />

      <SendReceiveDialog
        orderId={id}
        mode="send"
        open={sendOpen}
        onOpenChange={setSendOpen}
      />
      <SendReceiveDialog
        orderId={id}
        mode="receive"
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
      />
      <CloseOrderDialog order={order} open={closeOpen} onOpenChange={setCloseOpen} />
      <CancelOrderDialog orderId={id} open={cancelOpen} onOpenChange={setCancelOpen} />
    </>
  );
}
