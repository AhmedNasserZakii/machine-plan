'use client';

import { Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { DateText } from '@/components/common/date-text';
import { HolderChip } from '@/components/common/holder-chip';
import { SerialText } from '@/components/common/serial-text';
import { StatusChip } from '@/components/common/status-chip';
import { DetailPageScaffold } from '@/components/detail/detail-page-scaffold';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { AuditSection } from '@/features/audit/components';
import { Link } from '@/i18n/navigation';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { TRANSFER_STATUS_TONE } from '@/lib/theme/status-tone';

import { useSignatureMedia, useTransferDetail } from '../hooks/use-transfers';
import {
  asString,
  isWithinCancelWindow,
  partyName,
  type Transfer,
  type TransferItem,
  type TransferSignature,
} from '../model/types';
import { TransferCancelDialog } from './transfer-cancel-dialog';
import { TransferConfirmDialog } from './transfer-confirm-dialog';
import { TransferReceipt } from './transfer-receipt';
import { TransferRejectDialog } from './transfer-reject-dialog';

function MatchFlag({
  matches,
  scanned,
  label,
}: {
  matches: boolean | null | undefined;
  scanned: string | null | undefined;
  label: string;
}) {
  const t = useTranslations();
  if (!scanned) return null;
  if (matches === false) {
    return (
      <p className="t-caption text-danger">
        {label}: {scanned} ({t('shared.transfer_item_battery_mismatch')})
      </p>
    );
  }
  if (matches === true) {
    return (
      <p className="t-caption text-success">
        {label}: {scanned}
      </p>
    );
  }
  return (
    <p className="t-caption text-text-secondary">
      {label}: {scanned}
    </p>
  );
}

function ItemRow({ item }: { item: TransferItem }) {
  const t = useTranslations();
  return (
    <div className="space-y-xs border-b border-divider py-md last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        <SerialText value={item.machine.serial} />
        <span className="t-caption text-text-secondary">
          {asString(item.machine.model) ?? '—'}
        </span>
      </div>
      <p className="t-caption">
        {t('shared.transfer_item_condition')}:{' '}
        {t(`shared.item_condition_${item.condition.toLowerCase()}` as 'shared.item_condition_good')}
        <span className="mx-xs">·</span>
        {t('shared.transfer_item_charger')}:{' '}
        {item.hasCharger ? t('web.common.yes') : t('web.common.no')}
        <span className="mx-xs">·</span>
        {t('shared.transfer_item_box')}: {item.hasBox ? t('web.common.yes') : t('web.common.no')}
      </p>
      <MatchFlag
        label={t('web.transfers.battery')}
        scanned={asString(item.batterySerialScanned)}
        matches={typeof item.batteryMatches === 'boolean' ? item.batteryMatches : null}
      />
      <MatchFlag
        label={t('web.transfers.sim')}
        scanned={asString(item.simSerialScanned)}
        matches={typeof item.simMatches === 'boolean' ? item.simMatches : null}
      />
      <MatchFlag
        label={t('web.transfers.boxSerial')}
        scanned={asString(item.boxSerialScanned)}
        matches={typeof item.boxMatches === 'boolean' ? item.boxMatches : null}
      />
      {asString(item.notes) ? (
        <p className="t-caption text-text-secondary">{asString(item.notes)}</p>
      ) : null}
    </div>
  );
}

function SignatureBlock({
  transferId,
  signature,
}: {
  transferId: string;
  signature: TransferSignature;
}) {
  const t = useTranslations();
  const enabled = signature.method === 'DRAWN_SIGNATURE';
  const media = useSignatureMedia(transferId, signature.id, enabled);

  return (
    <div className="space-y-xs rounded-md border border-border p-md">
      <p className="t-label">
        {t('web.transfers.signedBy', {
          name: asString(signature.userFullName) ?? signature.userId,
        })}
      </p>
      <p className="t-caption text-text-secondary">
        {signature.partyRole} · <DateText value={signature.signedAt} format="datetime" />
      </p>
      {enabled && media.data?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.data.url}
          alt={t('shared.transfer_signature_title')}
          className="max-h-28 rounded-md border border-border"
        />
      ) : (
        <p className="t-caption text-text-secondary">
          {signature.method === 'BIOMETRIC'
            ? t('web.transfers.biometricSignature')
            : t('web.common.loading')}
        </p>
      )}
    </div>
  );
}

function Timeline({ transfer }: { transfer: Transfer }) {
  const t = useTranslations();
  const events = [
    {
      id: 'created',
      label: t('shared.timeline_transfer_pending'),
      at: transfer.createdAt,
    },
    transfer.status === 'CONFIRMED' && typeof transfer.confirmedAt === 'string'
      ? {
          id: 'confirmed',
          label: t('shared.timeline_transfer_confirmed'),
          at: transfer.confirmedAt,
        }
      : null,
    transfer.status === 'REJECTED'
      ? {
          id: 'rejected',
          label: t('shared.timeline_transfer_rejected'),
          at: typeof transfer.confirmedAt === 'string' ? transfer.confirmedAt : transfer.createdAt,
          detail: asString(transfer.rejectionReason),
        }
      : null,
    transfer.status === 'CANCELLED'
      ? {
          id: 'cancelled',
          label: t('shared.timeline_transfer_cancelled'),
          at: transfer.createdAt,
        }
      : null,
  ].filter(Boolean) as Array<{ id: string; label: string; at: string; detail?: string | null }>;

  return (
    <ol className="space-y-md">
      {events.map((event) => (
        <li key={event.id} className="border-s-2 border-primary ps-md">
          <p className="t-label">{event.label}</p>
          <DateText value={event.at} format="datetime" className="t-caption text-text-secondary" />
          {event.detail ? <p className="t-caption text-text-secondary">{event.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function TransferDetailPage({ id }: { id: string }) {
  const t = useTranslations();
  const { user, permissions } = useSession();
  const query = useTransferDetail(id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [banner, setBanner] = useState<'payload' | 'notPending' | 'cancelExpired' | null>(null);

  const transfer = query.data;

  const isReceiver = useMemo(() => {
    if (!transfer || !user) return false;
    return asString(transfer.to.id) === user.id;
  }, [transfer, user]);

  const isSenderLikely = useMemo(() => {
    if (!transfer || !user) return false;
    // Sender party may be warehouse/factory; cancel is still offered to holders of
    // transfers.cancel and the server enforces creator + window.
    return asString(transfer.from.id) === user.id || permissions.includes(P.transfersCancel);
  }, [permissions, transfer, user]);

  const canConfirm =
    transfer?.status === 'PENDING' &&
    permissions.includes(P.transfersConfirm) &&
    isReceiver;
  const canReject =
    transfer?.status === 'PENDING' &&
    permissions.includes(P.transfersReject) &&
    isReceiver;
  const canCancel =
    transfer?.status === 'PENDING' &&
    permissions.includes(P.transfersCancel) &&
    isSenderLikely &&
    isWithinCancelWindow(transfer.createdAt);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!transfer) {
    return (
      <EmptyState title={t('web.shell.notFoundTitle')} description={t('web.shell.notFoundBody')} />
    );
  }

  const refresh = async () => {
    setBanner(null);
    setConfirmOpen(false);
    setRejectOpen(false);
    setCancelOpen(false);
    await query.refetch();
  };

  return (
    <>
      <div className="no-print">
        <DetailPageScaffold
          title={<span className="t-mono">{transfer.referenceNo}</span>}
          breadcrumbs={
            <nav aria-label={t('web.common.breadcrumbs')} className="t-caption text-text-secondary">
              <Link href="/transfers" className="hover:underline">
                {t('shared.transfers_title')}
              </Link>
              <span className="mx-xs">/</span>
              <span className="t-mono">{transfer.referenceNo}</span>
            </nav>
          }
          status={
            <StatusChip
              status={transfer.status}
              tone={TRANSFER_STATUS_TONE[transfer.status] ?? 'neutral'}
              label={t(`enums.transferStatus.${transfer.status}` as 'enums.transferStatus.UNKNOWN')}
            />
          }
          subtitle={t(`enums.transferType.${transfer.type}` as 'enums.transferType.UNKNOWN')}
          actions={
            <div className="flex flex-wrap gap-sm">
              <Can perm={P.transfersRead}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.print()}
                >
                  <Printer className="size-4" aria-hidden />
                  {t('web.transfers.printReceipt')}
                </Button>
              </Can>
              {canConfirm ? (
                <Button type="button" onClick={() => setConfirmOpen(true)}>
                  {t('shared.transfer_action_confirm')}
                </Button>
              ) : null}
              {canReject ? (
                <Button type="button" variant="destructive" onClick={() => setRejectOpen(true)}>
                  {t('shared.transfer_action_reject')}
                </Button>
              ) : null}
              {canCancel ? (
                <Button type="button" variant="outline" onClick={() => setCancelOpen(true)}>
                  {t('shared.transfer_action_cancel')}
                </Button>
              ) : null}
            </div>
          }
          summary={
            <div className="space-y-md">
              <div>
                <p className="t-caption text-text-secondary">{t('shared.transfer_from')}</p>
                <HolderChip type={transfer.from.type} name={partyName(transfer.from)} />
              </div>
              <div>
                <p className="t-caption text-text-secondary">{t('shared.transfer_to')}</p>
                <HolderChip type={transfer.to.type} name={partyName(transfer.to)} />
              </div>
              <div>
                <p className="t-caption text-text-secondary">{t('web.transfers.createdAt')}</p>
                <DateText value={transfer.createdAt} format="datetime" />
              </div>
              <div>
                <p className="t-caption text-text-secondary">{t('shared.transfer_occurred_at')}</p>
                <DateText value={transfer.occurredAt} format="datetime" />
              </div>
              {asString(transfer.notes) ? (
                <div>
                  <p className="t-caption text-text-secondary">{t('shared.transfer_notes')}</p>
                  <p className="t-body">{asString(transfer.notes)}</p>
                </div>
              ) : null}
            </div>
          }
          tabs={[
            {
              id: 'machines',
              label: t('shared.transfer_machines_title'),
              content: (
                <div>
                  {transfer.items.map((item) => (
                    <ItemRow key={item.id} item={item} />
                  ))}
                </div>
              ),
            },
            {
              id: 'evidence',
              label: t('web.transfers.evidence'),
              content: (
                <div className="space-y-md">
                  {transfer.signatures.length === 0 ? (
                    <EmptyState
                      title={t('web.transfers.noSignatures')}
                      description={t('web.transfers.noSignaturesBody')}
                    />
                  ) : (
                    transfer.signatures.map((signature) => (
                      <SignatureBlock
                        key={signature.id}
                        transferId={transfer.id}
                        signature={signature}
                      />
                    ))
                  )}
                </div>
              ),
            },
            {
              id: 'timeline',
              label: t('web.transfers.timeline'),
              content: <Timeline transfer={transfer} />,
            },
            {
              id: 'audit',
              label: t('web.audit.sectionTitle'),
              content: <AuditSection entityType="transfer" entityId={transfer.id} />,
            },
          ]}
        />

        {banner === 'payload' ? (
          <div
            className="mt-md rounded-md border border-warning bg-warning-surface p-md"
            role="alert"
          >
            <p className="t-label">{t('shared.transfer_payload_changed_title')}</p>
            <p className="t-caption text-text-secondary">
              {t('shared.transfer_payload_changed_body')}
            </p>
            <Button type="button" className="mt-sm" variant="outline" onClick={() => void refresh()}>
              {t('shared.transfer_reload_and_review')}
            </Button>
          </div>
        ) : null}
        {banner === 'notPending' ? (
          <div className="mt-md rounded-md border border-info bg-info-surface p-md" role="status">
            <p className="t-body">{t('web.transfers.alreadyActed')}</p>
            <Button type="button" className="mt-sm" variant="outline" onClick={() => void refresh()}>
              {t('web.errors.conflictRefresh')}
            </Button>
          </div>
        ) : null}
        {banner === 'cancelExpired' ? (
          <div
            className="mt-md rounded-md border border-warning bg-warning-surface p-md"
            role="alert"
          >
            <p className="t-body">{t('web.transfers.cancelWindowExpired')}</p>
          </div>
        ) : null}
      </div>

      <TransferReceipt transfer={transfer} />

      {canConfirm ? (
        <TransferConfirmDialog
          transfer={transfer}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          onPayloadChanged={() => {
            setConfirmOpen(false);
            setBanner('payload');
            void query.refetch();
            toast.message(t('shared.transfer_payload_changed_title'));
          }}
          onNotPending={() => {
            setConfirmOpen(false);
            setBanner('notPending');
            void query.refetch();
          }}
        />
      ) : null}
      {canReject ? (
        <TransferRejectDialog
          transferId={transfer.id}
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          onNotPending={() => {
            setRejectOpen(false);
            setBanner('notPending');
            void query.refetch();
          }}
        />
      ) : null}
      {permissions.includes(P.transfersCancel) && transfer.status === 'PENDING' ? (
        <TransferCancelDialog
          transferId={transfer.id}
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          onNotPending={() => {
            setCancelOpen(false);
            setBanner('notPending');
            void query.refetch();
          }}
          onWindowExpired={() => {
            setCancelOpen(false);
            setBanner('cancelExpired');
          }}
        />
      ) : null}
    </>
  );
}
