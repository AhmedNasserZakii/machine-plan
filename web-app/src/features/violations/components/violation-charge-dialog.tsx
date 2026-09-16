'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Money } from '@/components/common/money';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { ErrorCode } from '@/lib/api/error-codes';
import { useCanMutate } from '@/lib/network/use-online';

import { useChargeViolationMutation, usePaymentMethods } from '../hooks/use-violations';
import type { Violation } from '../model/types';

type ViolationChargeDialogProps = {
  violation: Violation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAlreadyCharged: () => void;
};

export function ViolationChargeDialog({
  violation,
  open,
  onOpenChange,
  onAlreadyCharged,
}: ViolationChargeDialogProps) {
  const t = useTranslations();
  const canMutate = useCanMutate();
  const methodsQuery = usePaymentMethods(open);
  const mutation = useChargeViolationMutation(violation.id);

  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAmount('');
      setPaymentMethodId('');
      setNotes('');
      setError(null);
      return;
    }
    const methods = methodsQuery.data ?? [];
    if (methods.length === 1) setPaymentMethodId(methods[0]!.id);
  }, [methodsQuery.data, open]);

  const submit = async () => {
    setError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0.01) {
      setError(t('web.form.required'));
      return;
    }
    if (!paymentMethodId) {
      setError(t('web.form.required'));
      return;
    }

    try {
      await mutation.mutateAsync({
        amount: parsed,
        paymentMethodId,
        chargedAt: new Date().toISOString(),
        notes: notes.trim() || undefined,
      });
      toast.success(t('shared.violation_charge_done'));
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

  const methods = methodsQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('shared.violation_charge_title')}</DialogTitle>
          <DialogDescription>{t('web.violations.chargeFinanceSideEffect')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-md">
          <p className="t-caption text-warning">{t('web.violations.chargeIrreversible')}</p>

          <div className="space-y-xs">
            <Label htmlFor="charge-amount">{t('shared.violation_charged_amount')}</Label>
            <Input
              id="charge-amount"
              inputMode="decimal"
              dir="ltr"
              className="t-mono"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-xs">
            <Label htmlFor="charge-method">{t('web.violations.paymentMethod')}</Label>
            {methodsQuery.isLoading ? (
              <p className="t-caption text-text-secondary">{t('web.common.loading')}</p>
            ) : (
              <select
                id="charge-method"
                className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body"
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
              >
                <option value="">{t('web.form.selectPlaceholder')}</option>
                {methods.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-xs">
            <Label htmlFor="charge-notes">{t('web.violations.notes')}</Label>
            <Textarea
              id="charge-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              dir="auto"
              rows={2}
            />
          </div>

          {amount && Number.isFinite(Number(amount)) ? (
            <p className="t-caption text-text-secondary">
              {t('web.violations.chargeConfirmAmount')}: <Money value={Number(amount)} />
            </p>
          ) : null}

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
            disabled={mutation.isPending || !canMutate || !paymentMethodId || !amount}
            onClick={() => void submit()}
          >
            {t('shared.violation_charge')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
