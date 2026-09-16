'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { SerialText } from '@/components/common/serial-text';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api/client';
import { ErrorCode } from '@/lib/api/error-codes';
import { newIdempotencyKey } from '@/lib/api/idempotency';
import { uploadMedia } from '@/lib/api/media';
import { useCanMutate } from '@/lib/network/use-online';

import { useConfirmTransferMutation } from '../hooks/use-transfers';
import type { Transfer } from '../model/types';
import { asString } from '../model/types';
import { SignaturePad, type SignaturePadHandle } from './signature-pad';

type TransferConfirmDialogProps = {
  transfer: Transfer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPayloadChanged: () => void;
  onNotPending: () => void;
};

export function TransferConfirmDialog({
  transfer,
  open,
  onOpenChange,
  onPayloadChanged,
  onNotPending,
}: TransferConfirmDialogProps) {
  const t = useTranslations();
  const canMutate = useCanMutate();
  const padRef = useRef<SignaturePadHandle>(null);
  const [empty, setEmpty] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mutation = useConfirmTransferMutation(transfer.id);

  useEffect(() => {
    if (!open) {
      setEmpty(true);
      setError(null);
      padRef.current?.clear();
    }
  }, [open]);

  const submit = async () => {
    setError(null);
    if (padRef.current?.isEmpty()) {
      setError(t('shared.transfer_signature_required'));
      return;
    }
    const blob = await padRef.current?.toPngBlob();
    if (!blob) {
      setError(t('shared.transfer_signature_required'));
      return;
    }

    try {
      const file = new File([blob], 'signature.png', { type: 'image/png' });
      const uploaded = await uploadMedia({
        file,
        purpose: 'SIGNATURE',
        idempotencyKey: newIdempotencyKey(),
      });

      await mutation.mutateAsync({
        signature: {
          method: 'DRAWN_SIGNATURE',
          signatureMediaId: uploaded.id,
        },
        payloadHash: transfer.payloadHash,
      });

      toast.success(t('shared.transfer_confirmed'));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ErrorCode.PAYLOAD_CHANGED) {
          onPayloadChanged();
          return;
        }
        if (err.code === ErrorCode.TRANSFER_NOT_PENDING) {
          onNotPending();
          return;
        }
        setError(t(`errors.${err.code}` as 'errors.INTERNAL_ERROR'));
        return;
      }
      setError(t('web.errors.generic'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('shared.transfer_confirm_title')}</DialogTitle>
          <DialogDescription>{t('shared.transfer_confirm_intro')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-md">
          <p className="t-caption text-warning">{t('web.transfers.confirmIrreversible')}</p>
          <div className="rounded-md border border-border">
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-divider t-caption text-text-secondary">
                  <th className="px-sm py-xs font-medium">{t('web.machines.serial')}</th>
                  <th className="px-sm py-xs font-medium">{t('shared.transfer_item_condition')}</th>
                </tr>
              </thead>
              <tbody>
                {transfer.items.map((item) => (
                  <tr key={item.id} className="border-b border-divider last:border-0">
                    <td className="px-sm py-sm">
                      <SerialText value={item.machine.serial} />
                    </td>
                    <td className="px-sm py-sm t-caption">
                      {t(
                        `shared.item_condition_${item.condition.toLowerCase()}` as 'shared.item_condition_good',
                      )}
                      {asString(item.notes) ? (
                        <span className="ms-sm text-text-secondary">· {asString(item.notes)}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SignaturePad
            ref={padRef}
            onEmptyChange={setEmpty}
            clearLabel={t('shared.transfer_signature_clear')}
            undoLabel={t('shared.transfer_signature_undo')}
            hintLabel={t('shared.transfer_signature_hint')}
          />

          {error ? (
            <p className="t-caption text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {!canMutate ? (
            <p className="t-caption text-danger" role="status">
              {t('web.shell.offline')}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            {t('shared.cancel')}
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || empty || !canMutate}
            onClick={() => void submit()}
          >
            {t('shared.transfer_submit_signature')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
