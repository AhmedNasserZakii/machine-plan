'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { DateText } from '@/components/common/date-text';
import { HolderChip } from '@/components/common/holder-chip';
import { Money } from '@/components/common/money';
import { SerialText } from '@/components/common/serial-text';
import { StatusChip } from '@/components/common/status-chip';
import { DetailPageScaffold } from '@/components/detail/detail-page-scaffold';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { AuditSection } from '@/features/audit/components';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { qrSvgDataUrl } from '@/lib/qr/qr-code';
import { MACHINE_STATUS_TONE } from '@/lib/theme/status-tone';

import {
  useMachineChainQuery,
  useMachineCostsQuery,
  useMachineDetailQuery,
  useMachineMaintenanceHistoryQuery,
  useMachineTimelineQuery,
} from '../hooks';
import { asNumber, asText } from '../lib/value';
import { BulkMaintenanceDialog } from './bulk-maintenance-dialog';
import { MachineDetailActions } from './machine-detail-actions';
import { MachineDetailRail } from './machine-detail-rail';

export function MachineDetailPage({ id }: { id: string }) {
  const t = useTranslations();
  const { permissions } = useSession();
  const detail = useMachineDetailQuery(id);
  const [maintOpen, setMaintOpen] = useState(false);
  const printRef = useRef<(() => void) | null>(null);

  const machine = detail.data;

  const overview = useMemo(() => {
    if (!machine) return null;
    const holder = machine.holder;
    const holderLabel = holder
      ? t(`web.machines.holderType.${holder.type}` as 'web.machines.holderType.FACTORY')
      : null;
    return (
      <div className="space-y-md rounded-md border border-border bg-surface p-md">
        <dl className="grid gap-md sm:grid-cols-2">
          <div>
            <dt className="t-caption text-text-secondary">{t('web.machines.serial')}</dt>
            <dd>
              <SerialText value={machine.serial} />
            </dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.machines.batterySerial')}</dt>
            <dd>
              {machine.battery ? <SerialText value={machine.battery.serial} /> : '—'}
            </dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.machines.simSerial')}</dt>
            <dd>
              {asText(machine.simSerial) ? (
                <SerialText value={asText(machine.simSerial)!} />
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.machines.boxSerial')}</dt>
            <dd>
              {asText(machine.boxSerial) ? (
                <SerialText value={asText(machine.boxSerial)!} />
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.machines.type')}</dt>
            <dd>{machine.type.name}</dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.machines.model')}</dt>
            <dd>{machine.model.name}</dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.machines.holder')}</dt>
            <dd>
              {holder && holderLabel ? (
                <HolderChip type={holder.type} name={holderLabel} />
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.machines.branch')}</dt>
            <dd>{machine.branch?.name ?? '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="t-caption text-text-secondary">{t('web.machines.notes')}</dt>
            <dd className="whitespace-pre-wrap">{asText(machine.notes) ?? '—'}</dd>
          </div>
        </dl>
      </div>
    );
  }, [machine, t]);

  if (detail.isLoading) return <DetailSkeleton />;
  if (detail.error || !machine) {
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  }

  const printSticker = () => {
    const payload = asText(machine.qrPayload) ?? machine.serial;
    const qr = qrSvgDataUrl(payload, 220);
    const w = window.open('', '_blank', 'noopener,noreferrer,width=420,height=640');
    if (!w) return;
    w.document.write(`<!doctype html><html lang="ar"><head><meta charset="utf-8"/><title>${machine.serial}</title>
<style>
@page{size:80mm 100mm;margin:8mm}
body{font-family:ui-monospace,monospace;padding:16px;text-align:center}
.box{border:2px solid black;padding:20px}h1{font-size:20px;margin:12px 0 4px}
img{width:180px;height:180px;image-rendering:pixelated}
@media print{button{display:none}}
</style></head><body>
<div class="box"><img src="${qr}" alt="QR"/><h1 dir="ltr">${machine.serial}</h1><p>${machine.model.name}</p></div>
<button onclick="window.print()">${t('web.machines.printSticker')}</button></body></html>`);
    w.document.close();
  };
  printRef.current = printSticker;

  return (
    <>
      <DetailPageScaffold
        title={<SerialText value={machine.serial} className="t-h1" />}
        subtitle={`${machine.model.name} · ${machine.type.name}`}
        status={
          <StatusChip
            status={machine.status}
            tone={MACHINE_STATUS_TONE[machine.status] ?? 'neutral'}
            label={t(`enums.machineStatus.${machine.status}` as 'enums.machineStatus.UNKNOWN')}
          />
        }
        actions={
          <MachineDetailActions
            machine={machine}
            onOpenMaintenance={() => setMaintOpen(true)}
            onPrintSticker={printSticker}
          />
        }
        summary={<MachineDetailRail machine={machine} />}
        defaultTab="overview"
        tabs={[
          { id: 'overview', label: t('web.machines.tabOverview'), content: overview },
          {
            id: 'timeline',
            label: t('web.machines.tabTimeline'),
            content: <TimelineTab id={id} />,
          },
          {
            id: 'maintenance',
            label: t('web.machines.tabMaintenance'),
            content: <MaintenanceTab id={id} />,
          },
          {
            id: 'costs',
            label: t('web.machines.tabCosts'),
            content: can(permissions, P.financeRead) ? (
              <CostsTab id={id} />
            ) : (
              <EmptyState
                title={t('web.machines.costsNoAccessTitle')}
                description={t('web.machines.costsNoAccessBody')}
              />
            ),
          },
          {
            id: 'chain',
            label: t('web.machines.tabChain'),
            content: <ChainTab id={id} />,
          },
          {
            id: 'audit',
            label: t('web.audit.sectionTitle'),
            content: <AuditSection entityType="machine" entityId={id} />,
          },
        ]}
      />

      <BulkMaintenanceDialog
        open={maintOpen}
        onOpenChange={setMaintOpen}
        machines={[machine]}
        onDone={() => {
          void detail.refetch();
          toast.success(t('web.machines.maintenanceOpened'));
        }}
      />
    </>
  );
}

function TimelineTab({ id }: { id: string }) {
  const t = useTranslations();
  const query = useMachineTimelineQuery(id);
  const events = query.data?.pages.flatMap((p) => p.data) ?? [];

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!events.length) {
    return (
      <EmptyState
        title={t('web.machines.timelineEmptyTitle')}
        description={t('web.machines.timelineEmptyBody')}
      />
    );
  }

  return (
    <div className="space-y-md">
      <ol className="relative space-y-md border-s border-divider ps-md">
        {events.map((event) => (
          <li key={`${event.type}-${event.refId}-${event.at}`} className="space-y-xs">
            <p className="t-caption text-text-secondary">
              <DateText value={event.at} format="datetime" />
            </p>
            <p className="t-body">
              {t(`web.machines.timeline.${event.type}` as 'web.machines.timeline.TRANSFER_PENDING')}
            </p>
            {asText(event.refNo) ? (
              <p className="t-mono t-caption" dir="ltr">
                {asText(event.refNo)}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      {query.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t('web.table.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}

function MaintenanceTab({ id }: { id: string }) {
  const t = useTranslations();
  const query = useMachineMaintenanceHistoryQuery(id);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const orders = query.data?.orders ?? [];
  if (!orders.length) {
    return (
      <EmptyState
        title={t('web.machines.maintenanceEmptyTitle')}
        description={t('web.machines.maintenanceEmptyBody')}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-start">
        <thead className="bg-surface-alt t-caption text-text-secondary">
          <tr>
            <th className="px-md py-sm">{t('web.machines.orderNo')}</th>
            <th className="px-md py-sm">{t('web.machines.status')}</th>
            <th className="px-md py-sm">{t('web.machines.maintenanceLocation')}</th>
            <th className="px-md py-sm">{t('web.machines.totalRepairCost')}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-divider">
              <td className="px-md py-sm">
                <Link href={`/maintenance/${order.id}`} className="t-mono text-primary hover:underline">
                  {order.referenceNo}
                </Link>
              </td>
              <td className="px-md py-sm">
                {t(`enums.maintenanceStatus.${order.status}` as 'enums.maintenanceStatus.UNKNOWN')}
              </td>
              <td className="px-md py-sm">{order.location?.name ?? '—'}</td>
              <td className="px-md py-sm">
                <Money value={asNumber(order.cost)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CostsTab({ id }: { id: string }) {
  const t = useTranslations();
  const query = useMachineCostsQuery(id);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;
  if (!data) return null;

  const ratio = asNumber(data.costToValueRatio);

  return (
    <div className="space-y-md rounded-md border border-border bg-surface p-md">
      <dl className="grid gap-md sm:grid-cols-2">
        <div>
          <dt className="t-caption text-text-secondary">{t('web.machines.purchasePrice')}</dt>
          <dd>
            <Money value={asNumber(data.purchasePrice)} />
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.machines.totalRepairCost')}</dt>
          <dd>
            <Money value={data.totalRepairCost} />
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.machines.repairCount')}</dt>
          <dd>{data.repairCount}</dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.machines.costVsPrice')}</dt>
          <dd>{ratio !== null ? `${ratio}%` : '—'}</dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.machines.chargedCompany')}</dt>
          <dd>
            <Money value={data.chargedToCompany} />
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.machines.chargedReps')}</dt>
          <dd>
            <Money value={data.chargedToRepresentatives} />
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.machines.chargedMerchants')}</dt>
          <dd>
            <Money value={data.chargedToMerchants} />
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.machines.freeUnderWarranty')}</dt>
          <dd>
            <Money value={data.freeUnderWarranty} />
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.machines.recommendation')}</dt>
          <dd>
            {t(
              `web.machines.recommendation.${data.recommendation}` as 'web.machines.recommendation.KEEP',
            )}
          </dd>
        </div>
      </dl>
      {ratio !== null ? (
        <div className="h-3 overflow-hidden rounded-pill bg-surface-alt" aria-hidden>
          <div
            className="h-full bg-warning"
            style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ChainTab({ id }: { id: string }) {
  const t = useTranslations();
  const query = useMachineChainQuery(id);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const chain = query.data?.chain ?? [];
  if (!chain.length) {
    return (
      <EmptyState
        title={t('web.machines.chainEmptyTitle')}
        description={t('web.machines.chainEmptyBody')}
      />
    );
  }

  return (
    <ol className="space-y-sm">
      {chain.map((link) => (
        <li
          key={link.id}
          className={`rounded-md border border-border p-md ${link.isCurrent ? 'border-primary' : ''}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <Link href={`/machines/${link.id}`} className="t-mono text-primary hover:underline">
              <bdi dir="ltr">{link.serial}</bdi>
            </Link>
            <StatusChip
              status={link.status}
              tone={MACHINE_STATUS_TONE[link.status] ?? 'neutral'}
              label={t(`enums.machineStatus.${link.status}` as 'enums.machineStatus.UNKNOWN')}
            />
          </div>
          <p className="mt-xs t-caption text-text-secondary">
            {t('web.machines.chainPosition', { position: link.position })} ·{' '}
            {t('web.machines.repairCount')}: {link.repairCount} ·{' '}
            <Money value={link.repairCost} />
          </p>
        </li>
      ))}
    </ol>
  );
}
