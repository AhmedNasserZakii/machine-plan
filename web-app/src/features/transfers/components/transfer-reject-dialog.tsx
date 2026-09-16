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

import { useRejectTransferMutation } from '../hooks/use-transfers';

type TransferRejectDialogProps = {
  transferId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotPending: () => void;
};

export function TransferRejectDialog({
  transferId,
  open,
  onOpenChange,
  onNotPending,
}: TransferRejectDialogProps) {
  const t = useTranslations();
  const canMutate = useCanMutate();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useRejectTransferMutation(transferId);

  useEffect(() => {
    if (!open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setError(null);
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(t('web.form.required'));
      return;
    }
    try {
      await mutation.mutateAsync({ reason: trimmed });
      toast.success(t('shared.transfer_rejected'));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
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
          <DialogTitle>{t('shared.transfer_reject_title')}</DialogTitle>
          <DialogDescription>{t('shared.transfer_reject_warning')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-xs">
          <Label htmlFor="reject-reason">{t('shared.transfer_reject_hint')}</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            dir="auto"
            rows={4}
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
            disabled={mutation.isPending || !reason.trim() || !canMutate}
            onClick={() => void submit()}
          >
            {t('shared.transfer_action_reject')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
