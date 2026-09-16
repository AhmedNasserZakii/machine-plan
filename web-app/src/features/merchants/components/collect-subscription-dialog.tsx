'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { useCanMutate } from '@/lib/network/use-online';

import { useCollectSubscriptionMutation } from '../hooks';
import type { Subscription } from '../model';

type CollectSubscriptionDialogProps = {
  merchantId: string;
  subscription: Subscription | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const amountSchema = z.coerce.number().positive();

export function CollectSubscriptionDialog({
  merchantId,
  subscription,
  open,
  onOpenChange,
}: CollectSubscriptionDialogProps) {
  const t = useTranslations();
  const { permissions } = useSession();
  const canMutate = useCanMutate();
  const canSeeMoney = can(permissions, P.financeRead);
  const mutation = useCollectSubscriptionMutation(merchantId);
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const methods = useQuery({
    queryKey: ['lookups', 'payment-methods'],
    enabled: open,
    queryFn: async () => {
      const result = await api.get<{ id: string; name: string }[]>(
        endpoints.lookups.paymentMethods,
        { limit: 100, isActive: true },
      );
      return Array.isArray(result.data) ? result.data : [];
    },
  });

  const submit = async () => {
    setError(null);
    if (!subscription) return;
    const parsed = amountSchema.safeParse(amount);
    if (!parsed.success) {
      setError(t('web.form.required'));
      return;
    }
    if (!paymentMethodId) {
      setError(t('web.form.required'));
      return;
    }
    try {
      await mutation.mutateAsync({
        id: subscription.id,
        body: {
          amount: parsed.data,
          collectedAt: new Date().toISOString(),
          paymentMethodId,
          notes: notes.trim() || undefined,
        },
      });
      toast.success(t('shared.subscription_collect_done'));
      onOpenChange(false);
      setAmount('');
      setPaymentMethodId('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('web.errors.generic'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('shared.subscription_collect_title')}</DialogTitle>
          <DialogDescription>{t('web.merchants.collectFinanceHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          <div className="space-y-xs">
            <Label htmlFor="collect-amount">{t('shared.subscription_collect_amount')}</Label>
            {canSeeMoney ? (
              <Input
                id="collect-amount"
                dir="ltr"
                className="t-mono"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={subscription ? String(subscription.amount) : undefined}
              />
            ) : (
              <p className="t-caption text-text-secondary">{t('web.common.moneyHidden')}</p>
            )}
          </div>
          <div className="space-y-xs">
            <Label htmlFor="collect-method">{t('shared.subscription_collect_method')}</Label>
            <select
              id="collect-method"
              className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body"
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
            >
              <option value="">{t('web.form.selectPlaceholder')}</option>
              {(methods.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-xs">
            <Label htmlFor="collect-notes">{t('web.merchants.notes')}</Label>
            <Input id="collect-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
            {t('shared.subscription_collect')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
