'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { ErrorCode } from '@/lib/api/error-codes';
import { useCanMutate } from '@/lib/network/use-online';

import { useCancelTransferMutation } from '../hooks/use-transfers';

type TransferCancelDialogProps = {
  transferId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotPending: () => void;
  onWindowExpired: () => void;
};

export function TransferCancelDialog({
  transferId,
  open,
  onOpenChange,
  onNotPending,
  onWindowExpired,
}: TransferCancelDialogProps) {
  const t = useTranslations();
  const canMutate = useCanMutate();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useCancelTransferMutation(transferId);

  useEffect(() => {
    if (!open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setError(null);
    try {
      const trimmed = reason.trim();
      await mutation.mutateAsync(trimmed ? { reason: trimmed } : undefined);
      toast.success(t('shared.transfer_cancelled'));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ErrorCode.CANCEL_WINDOW_EXPIRED) {
          onWindowExpired();
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('shared.transfer_cancel_title')}</DialogTitle>
          <DialogDescription>{t('web.transfers.cancelDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-xs">
          <Label htmlFor="cancel-reason">{t('shared.transfer_cancel_hint')}</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            dir="auto"
            rows={3}
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
            variant="destructive"
            disabled={mutation.isPending || !canMutate}
            onClick={() => void submit()}
          >
            {t('shared.transfer_action_cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
