'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SignaturePad, type SignaturePadHandle } from '@/features/transfers/components/signature-pad';
import { ApiError } from '@/lib/api/client';
import { newIdempotencyKey } from '@/lib/api/idempotency';
import { uploadMedia } from '@/lib/api/media';
import { useCanMutate } from '@/lib/network/use-online';

import {
  useReceiveMaintenanceMutation,
  useSendMaintenanceMutation,
} from '../hooks';

type SendReceiveDialogProps = {
  orderId: string;
  mode: 'send' | 'receive';
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SendReceiveDialog({
  orderId,
  mode,
  open,
  onOpenChange,
}: SendReceiveDialogProps) {
  const t = useTranslations();
  const canMutate = useCanMutate();
  const padRef = useRef<SignaturePadHandle>(null);
  const [empty, setEmpty] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sendMutation = useSendMaintenanceMutation(orderId);
  const receiveMutation = useReceiveMaintenanceMutation(orderId);
  const pending = sendMutation.isPending || receiveMutation.isPending;

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
      const body = {
        signature: {
          method: 'DRAWN_SIGNATURE' as const,
          signatureMediaId: uploaded.id,
        },
      };
      if (mode === 'send') {
        await sendMutation.mutateAsync(body);
        toast.success(t('web.maintenance.sent'));
      } else {
        await receiveMutation.mutateAsync(body);
        toast.success(t('web.maintenance.received'));
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
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
          <DialogTitle>
            {mode === 'send' ? t('web.maintenance.sendTitle') : t('web.maintenance.receiveTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'send'
              ? t('web.maintenance.sendBody')
              : t('web.maintenance.receiveBody')}
          </DialogDescription>
        </DialogHeader>
        <SignaturePad
          ref={padRef}
          onEmptyChange={setEmpty}
          clearLabel={t('shared.transfer_signature_clear')}
          undoLabel={t('shared.transfer_signature_undo')}
          hintLabel={t('shared.transfer_signature_hint')}
        />
        {error ? <p className="t-caption text-danger">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {t('web.common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={pending || empty || !canMutate}
            onClick={() => void submit()}
          >
            {mode === 'send' ? t('web.maintenance.send') : t('web.maintenance.receive')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
