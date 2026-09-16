'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { useCanMutate } from '@/lib/network/use-online';

import { useCreateSubscriptionMutation } from '../hooks';
import { SUBSCRIPTION_PLAN_TYPES, type SubscriptionPlanType } from '../model';

type AddSubscriptionDialogProps = {
  merchantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddSubscriptionDialog({
  merchantId,
  open,
  onOpenChange,
}: AddSubscriptionDialogProps) {
  const t = useTranslations();
  const { permissions } = useSession();
  const canMutate = useCanMutate();
  const canSeeMoney = can(permissions, P.financeRead);
  const mutation = useCreateSubscriptionMutation(merchantId);
  const [planType, setPlanType] = useState<SubscriptionPlanType>('MONTHLY');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError(t('web.form.required'));
      return;
    }
    try {
      await mutation.mutateAsync({
        planType,
        amount: n,
        startDate,
        notes: notes.trim() || undefined,
      });
      toast.success(t('shared.subscription_created'));
      onOpenChange(false);
      setAmount('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('web.errors.generic'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('shared.subscription_add')}</DialogTitle>
          <DialogDescription>{t('web.merchants.addSubscriptionBody')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          <div className="space-y-xs">
            <Label htmlFor="sub-plan">{t('shared.subscription_plan')}</Label>
            <select
              id="sub-plan"
              className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body"
              value={planType}
              onChange={(e) => setPlanType(e.target.value as SubscriptionPlanType)}
            >
              {SUBSCRIPTION_PLAN_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`web.merchants.planType.${value}` as 'web.merchants.planType.MONTHLY')}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-xs">
            <Label htmlFor="sub-amount">{t('shared.subscription_amount')}</Label>
            {canSeeMoney ? (
              <Input
                id="sub-amount"
                dir="ltr"
                className="t-mono"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            ) : (
              <p className="t-caption text-text-secondary">{t('web.common.moneyHidden')}</p>
            )}
          </div>
          <div className="space-y-xs">
            <Label htmlFor="sub-start">{t('shared.subscription_start_date')}</Label>
            <Input
              id="sub-start"
              type="date"
              dir="ltr"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-xs">
            <Label htmlFor="sub-notes">{t('web.merchants.notes')}</Label>
            <Input id="sub-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error ? <p className="t-caption text-danger">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('web.common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!canMutate || mutation.isPending || !canSeeMoney}
            onClick={() => void submit()}
          >
            {t('shared.subscription_add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
