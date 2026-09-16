'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { SerialText } from '@/components/common/serial-text';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { ErrorCode } from '@/lib/api/error-codes';

import { useDeactivateMerchantMutation } from '../hooks';
import type { Merchant } from '../model';

type DeactivateMerchantDialogProps = {
  merchant: Merchant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeactivateMerchantDialog({
  merchant,
  open,
  onOpenChange,
}: DeactivateMerchantDialogProps) {
  const t = useTranslations();
  const mutation = useDeactivateMerchantMutation(merchant.id);
  const [heldSerials, setHeldSerials] = useState<string[]>([]);

  const confirm = async () => {
    setHeldSerials([]);
    try {
      await mutation.mutateAsync();
      toast.success(t('web.merchants.deactivated'));
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === ErrorCode.MERCHANT_HAS_MACHINES) {
        const serials =
          error.details
            ?.filter((d) => d.field === 'machines' && typeof d.value === 'string')
            .map((d) => String(d.value)) ?? [];
        setHeldSerials(serials);
        return;
      }
      toast.error(error instanceof Error ? error.message : t('web.errors.generic'));
    }
  };

  return (
    <>
      <ConfirmDialog
        open={open && heldSerials.length === 0}
        onOpenChange={onOpenChange}
        title={t('web.merchants.deactivateTitle')}
        description={t('web.merchants.deactivateBody', { name: merchant.name })}
        confirmLabel={t('web.merchants.deactivate')}
        destructive
        pending={mutation.isPending}
        onConfirm={confirm}
      />

      <ConfirmDialog
        open={open && heldSerials.length > 0}
        onOpenChange={(next) => {
          if (!next) {
            setHeldSerials([]);
            onOpenChange(false);
          }
        }}
        title={t('web.merchants.hasMachinesTitle')}
        description={
          <div className="space-y-sm">
            <p>{t('web.merchants.hasMachinesBody', { count: heldSerials.length })}</p>
            <ul className="space-y-xs">
              {heldSerials.map((serial) => (
                <li key={serial}>
                  <SerialText value={serial} />
                </li>
              ))}
            </ul>
            <p>
              <Link
                href={`/transfers/new?type=MERCHANT_TO_REPRESENTATIVE&merchantId=${merchant.id}`}
                className="text-primary hover:underline"
              >
                {t('web.merchants.collectMachinesCta')}
              </Link>
            </p>
          </div>
        }
        confirmLabel={t('web.common.close')}
        onConfirm={() => {
          setHeldSerials([]);
          onOpenChange(false);
        }}
      />
    </>
  );
}
