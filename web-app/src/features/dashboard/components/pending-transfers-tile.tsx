'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { DateText } from '@/components/common/date-text';
import { Button } from '@/components/ui/button';
import { TransferCancelDialog } from '@/features/transfers/components/transfer-cancel-dialog';
import { TransferConfirmDialog } from '@/features/transfers/components/transfer-confirm-dialog';
import { TransferRejectDialog } from '@/features/transfers/components/transfer-reject-dialog';
import {
  usePendingIncomingTransfers,
  usePendingOutgoingTransfers,
  useTransferDetail,
} from '@/features/transfers/hooks/use-transfers';
import type { TransferListItem } from '@/features/transfers/model/types';
import { partyName } from '@/features/transfers/model/types';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';

import { DashboardTile } from './dashboard-tile';

function PendingActions({
  item,
  direction,
}: {
  item: TransferListItem;
  direction: 'incoming' | 'outgoing';
}) {
  const t = useTranslations();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const detail = useTransferDetail(confirmOpen ? item.id : '');

  if (direction === 'incoming') {
    return (
      <div className="flex flex-wrap gap-xs">
        <Can perm={P.transfersConfirm}>
          <Button
            type="button"
            size="sm"
            disabled={confirmOpen && (detail.isLoading || !detail.data)}
            onClick={() => setConfirmOpen(true)}
          >
            {confirmOpen && detail.isLoading
              ? t('web.common.loading')
              : t('shared.transfer_action_confirm')}
          </Button>
        </Can>
        <Can perm={P.transfersReject}>
          <Button type="button" size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
            {t('shared.transfer_action_reject')}
          </Button>
        </Can>
        {confirmOpen && detail.data ? (
          <TransferConfirmDialog
            transfer={detail.data}
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            onPayloadChanged={() => {
              setConfirmOpen(false);
              toast.message(t('shared.transfer_payload_changed_title'));
              void detail.refetch();
            }}
            onNotPending={() => {
              setConfirmOpen(false);
              void detail.refetch();
            }}
          />
        ) : null}
        <TransferRejectDialog
          transferId={item.id}
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          onNotPending={() => setRejectOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-xs">
      <Can perm={P.transfersCancel}>
        <Button type="button" size="sm" variant="outline" onClick={() => setCancelOpen(true)}>
          {t('shared.transfer_action_cancel')}
        </Button>
      </Can>
      <TransferCancelDialog
        transferId={item.id}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onNotPending={() => setCancelOpen(false)}
        onWindowExpired={() => {
          setCancelOpen(false);
          toast.error(t('web.transfers.cancelWindowExpired'));
        }}
      />
    </div>
  );
}

export function PendingIncomingTile() {
  const t = useTranslations();
  const { permissions } = useSession();
  const allowed = can(permissions, P.transfersRead);
  const query = usePendingIncomingTransfers(5, allowed);

  if (!allowed) return null;

  return (
    <DashboardTile
      title={t('web.dashboard.pendingIncoming')}
      viewAllHref="/transfers?view=incoming"
      count={query.data?.length}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      isEmpty={(query.data?.length ?? 0) === 0}
      emptyTitle={t('web.dashboard.noPendingIncoming')}
      emptyBody={t('web.dashboard.noPendingIncomingBody')}
    >
      <ul className="divide-y divide-border">
        {(query.data ?? []).map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-sm py-sm"
          >
            <div className="min-w-0">
              <Link href={`/transfers/${item.id}`} className="t-mono t-label hover:underline">
                {item.referenceNo}
              </Link>
              <p className="t-caption text-text-secondary">
                {partyName(item.from)}
                <span className="mx-xs">·</span>
                {t('web.dashboard.machineCount', { count: item.itemsCount })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-xs">
              <DateText
                value={item.createdAt}
                format="relative"
                className="t-caption text-text-secondary"
              />
              <PendingActions item={item} direction="incoming" />
            </div>
          </li>
        ))}
      </ul>
    </DashboardTile>
  );
}

export function PendingOutgoingTile() {
  const t = useTranslations();
  const { permissions } = useSession();
  const allowed = can(permissions, P.transfersRead);
  const query = usePendingOutgoingTransfers(5, allowed);

  if (!allowed) return null;

  return (
    <DashboardTile
      title={t('web.dashboard.pendingOutgoing')}
      viewAllHref="/transfers?view=outgoing"
      count={query.data?.length}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      isEmpty={(query.data?.length ?? 0) === 0}
      emptyTitle={t('web.dashboard.noPendingOutgoing')}
      emptyBody={t('web.dashboard.noPendingOutgoingBody')}
    >
      <ul className="divide-y divide-border">
        {(query.data ?? []).map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-sm py-sm"
          >
            <div className="min-w-0">
              <Link href={`/transfers/${item.id}`} className="t-mono t-label hover:underline">
                {item.referenceNo}
              </Link>
              <p className="t-caption text-text-secondary">
                {partyName(item.to)}
                <span className="mx-xs">·</span>
                {t('web.dashboard.machineCount', { count: item.itemsCount })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-xs">
              <DateText
                value={item.createdAt}
                format="relative"
                className="t-caption text-text-secondary"
              />
              <PendingActions item={item} direction="outgoing" />
            </div>
          </li>
        ))}
      </ul>
    </DashboardTile>
  );
}
