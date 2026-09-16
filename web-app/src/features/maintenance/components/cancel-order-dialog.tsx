'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';

import { useCancelMaintenanceMutation } from '../hooks';

type CancelOrderDialogProps = {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CancelOrderDialog({ orderId, open, onOpenChange }: CancelOrderDialogProps) {
  const t = useTranslations();
  const mutation = useCancelMaintenanceMutation(orderId);
  const [reason, setReason] = useState('');

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('');
        onOpenChange(next);
      }}
      title={t('web.maintenance.cancelTitle')}
      description={
        <div className="space-y-sm">
          <p>{t('web.maintenance.cancelBody')}</p>
          <div className="space-y-xs">
            <Label htmlFor="cancel-reason">{t('web.maintenance.cancelReason')}</Label>
            <Input
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
      }
      confirmLabel={t('web.maintenance.cancel')}
      destructive
      pending={mutation.isPending}
      onConfirm={async () => {
        if (!reason.trim()) {
          toast.error(t('web.form.required'));
          throw new Error('required');
        }
        try {
          await mutation.mutateAsync({ reason: reason.trim() });
          toast.success(t('web.maintenance.cancelled'));
          onOpenChange(false);
          setReason('');
        } catch (error) {
          if (error instanceof ApiError) {
            toast.error(t(`errors.${error.code}` as 'errors.INTERNAL_ERROR'));
          } else {
            toast.error(t('web.errors.generic'));
          }
          throw error;
        }
      }}
    />
  );
}
