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

import { useWaiveViolationMutation } from '../hooks/use-violations';

type ViolationWaiveDialogProps = {
  violationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAlreadyCharged: () => void;
};

export function ViolationWaiveDialog({
  violationId,
  open,
  onOpenChange,
  onAlreadyCharged,
}: ViolationWaiveDialogProps) {
  const t = useTranslations();
  const canMutate = useCanMutate();
  const mutation = useWaiveViolationMutation(violationId);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setError(null);
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError(t('web.form.required'));
      return;
    }
    try {
      await mutation.mutateAsync({ reason: trimmed });
      toast.success(t('shared.violation_waive_done'));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ErrorCode.ALREADY_CHARGED) {
          onAlreadyCharged();
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
          <DialogTitle>{t('shared.violation_waive_title')}</DialogTitle>
          <DialogDescription>{t('web.violations.waiveDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-xs">
          <Label htmlFor="waive-reason">{t('shared.violation_waiver_reason')}</Label>
          <Textarea
            id="waive-reason"
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
            disabled={mutation.isPending || reason.trim().length < 5 || !canMutate}
            onClick={() => void submit()}
          >
            {t('shared.violation_waive')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
