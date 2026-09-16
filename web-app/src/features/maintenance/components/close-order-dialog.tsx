'use client';

import { useQuery } from '@tanstack/react-query';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { ErrorCode } from '@/lib/api/error-codes';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { useCanMutate } from '@/lib/network/use-online';

import { useCloseMaintenanceMutation } from '../hooks';
import type { CloseMaintenanceOrderDto, MaintenanceOrder, MaintenanceResult, ResponsibleParty } from '../model';
import { MAINTENANCE_RESULTS, RESPONSIBLE_PARTIES } from '../model';

type CloseOrderDialogProps = {
  order: MaintenanceOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CloseOrderDialog({ order, open, onOpenChange }: CloseOrderDialogProps) {
  const t = useTranslations();
  const { permissions } = useSession();
  const canMutate = useCanMutate();
  const canSetCost = can(permissions, P.maintenanceSetCost);
  const canClose = can(permissions, P.maintenanceClose);
  const mutation = useCloseMaintenanceMutation(order.id);

  const [result, setResult] = useState<MaintenanceResult>('REPAIRED');
  const [isFree, setIsFree] = useState(Boolean(order.suggestedFreeUnderWarranty));
  const [cost, setCost] = useState('');
  const [party, setParty] = useState<ResponsibleParty>('COMPANY');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [responsibleUserId, setResponsibleUserId] = useState('');
  const [responsibleMerchantId, setResponsibleMerchantId] = useState('');
  const [performedByName, setPerformedByName] = useState('');
  const [notes, setNotes] = useState('');
  const [newSerial, setNewSerial] = useState('');
  const [newBattery, setNewBattery] = useState('');
  const [newSim, setNewSim] = useState('');
  const [hasBox, setHasBox] = useState(false);
  const [replaceReason, setReplaceReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [forceReplace, setForceReplace] = useState(false);

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

  useEffect(() => {
    if (!open) {
      setError(null);
      setForceReplace(false);
    }
  }, [open]);

  const needsReplace = result === 'REPLACED' || forceReplace;

  const submit = async () => {
    setError(null);
    if (!canClose) return;

    const costNum = cost.trim() ? Number(cost) : undefined;
    if (!isFree && (costNum === undefined || Number.isNaN(costNum))) {
      setError(t('errors.COST_REQUIRED'));
      return;
    }
    if (needsReplace && (!newSerial.trim() || !newBattery.trim() || !replaceReason.trim())) {
      setError(t('errors.REPLACEMENT_PAYLOAD_REQUIRED'));
      return;
    }

    const body: CloseMaintenanceOrderDto = {
      result: needsReplace ? 'REPLACED' : result,
      isFreeUnderWarranty: isFree,
      cost: isFree ? undefined : costNum,
      responsibleParty: party,
      responsibleUserId: party === 'REPRESENTATIVE' ? responsibleUserId || undefined : undefined,
      responsibleMerchantId: party === 'MERCHANT' ? responsibleMerchantId || undefined : undefined,
      paymentMethodId: party === 'COMPANY' && !isFree ? paymentMethodId || undefined : undefined,
      performedByName: performedByName.trim() || undefined,
      returnedAt: new Date().toISOString(),
      notes: notes.trim() || undefined,
      replacement: needsReplace
        ? {
            newSerial: newSerial.trim(),
            newBattery: { serial: newBattery.trim() },
            newSimSerial: newSim.trim() || undefined,
            hasBox,
            reason: replaceReason.trim(),
            replacedAt: new Date().toISOString(),
          }
        : undefined,
    };

    try {
      await mutation.mutateAsync(body);
      toast.success(t('web.maintenance.closed'));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ErrorCode.COST_REQUIRED) {
          setError(t('errors.COST_REQUIRED'));
          return;
        }
        if (err.code === ErrorCode.REPLACEMENT_PAYLOAD_REQUIRED) {
          setForceReplace(true);
          setResult('REPLACED');
          setError(t('errors.REPLACEMENT_PAYLOAD_REQUIRED'));
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
          <DialogTitle>{t('web.maintenance.closeTitle')}</DialogTitle>
          <DialogDescription>{t('web.maintenance.closeFinanceHint')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-md">
          <div className="space-y-xs">
            <Label htmlFor="close-result">{t('web.maintenance.resultLabel')}</Label>
            <select
              id="close-result"
              className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body"
              value={result}
              onChange={(e) => setResult(e.target.value as MaintenanceResult)}
            >
              {MAINTENANCE_RESULTS.map((value) => (
                <option key={value} value={value}>
                  {t(`web.maintenance.result.${value}` as 'web.maintenance.result.REPAIRED')}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-sm t-body">
            <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
            {t('web.maintenance.freeUnderWarranty')}
          </label>

          {!isFree && canSetCost ? (
            <div className="space-y-xs">
              <Label htmlFor="close-cost">{t('web.maintenance.cost')}</Label>
              <Input
                id="close-cost"
                dir="ltr"
                className="t-mono"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
          ) : null}

          <div className="space-y-xs">
            <Label htmlFor="close-party">{t('web.maintenance.responsibleParty')}</Label>
            <select
              id="close-party"
              className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body"
              value={party}
              onChange={(e) => setParty(e.target.value as ResponsibleParty)}
            >
              {RESPONSIBLE_PARTIES.map((value) => (
                <option key={value} value={value}>
                  {t(`web.maintenance.party.${value}` as 'web.maintenance.party.COMPANY')}
                </option>
              ))}
            </select>
          </div>

          {party === 'REPRESENTATIVE' ? (
            <div className="space-y-xs">
              <Label htmlFor="close-user">{t('web.maintenance.responsibleUserId')}</Label>
              <Input
                id="close-user"
                dir="ltr"
                className="t-mono"
                value={responsibleUserId}
                onChange={(e) => setResponsibleUserId(e.target.value)}
              />
            </div>
          ) : null}

          {party === 'MERCHANT' ? (
            <div className="space-y-xs">
              <Label htmlFor="close-merchant">{t('web.maintenance.responsibleMerchantId')}</Label>
              <Input
                id="close-merchant"
                dir="ltr"
                className="t-mono"
                value={responsibleMerchantId}
                onChange={(e) => setResponsibleMerchantId(e.target.value)}
              />
            </div>
          ) : null}

          {party === 'COMPANY' && !isFree ? (
            <div className="space-y-xs">
              <Label htmlFor="close-pm">{t('shared.subscription_collect_method')}</Label>
              <select
                id="close-pm"
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
          ) : null}

          <div className="space-y-xs">
            <Label htmlFor="close-tech">{t('web.maintenance.performedBy')}</Label>
            <Input
              id="close-tech"
              value={performedByName}
              onChange={(e) => setPerformedByName(e.target.value)}
            />
          </div>

          {needsReplace ? (
            <div className="space-y-md rounded-md border border-border p-md">
              <p className="t-body font-medium">{t('web.maintenance.replaceSection')}</p>
              <div className="space-y-xs">
                <Label htmlFor="new-serial">{t('web.maintenance.newSerial')}</Label>
                <Input
                  id="new-serial"
                  dir="ltr"
                  className="t-mono"
                  value={newSerial}
                  onChange={(e) => setNewSerial(e.target.value)}
                />
              </div>
              <div className="space-y-xs">
                <Label htmlFor="new-battery">{t('web.machines.batterySerial')}</Label>
                <Input
                  id="new-battery"
                  dir="ltr"
                  className="t-mono"
                  value={newBattery}
                  onChange={(e) => setNewBattery(e.target.value)}
                />
              </div>
              <div className="space-y-xs">
                <Label htmlFor="new-sim">{t('web.machines.simSerial')}</Label>
                <Input
                  id="new-sim"
                  dir="ltr"
                  className="t-mono"
                  value={newSim}
                  onChange={(e) => setNewSim(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-sm t-body">
                <input type="checkbox" checked={hasBox} onChange={(e) => setHasBox(e.target.checked)} />
                {t('web.machines.hasBox')}
              </label>
              <div className="space-y-xs">
                <Label htmlFor="replace-reason">{t('web.maintenance.replaceReason')}</Label>
                <Input
                  id="replace-reason"
                  value={replaceReason}
                  onChange={(e) => setReplaceReason(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <label className="flex items-center gap-sm t-body">
              <input
                type="checkbox"
                checked={forceReplace}
                onChange={(e) => {
                  setForceReplace(e.target.checked);
                  if (e.target.checked) setResult('REPLACED');
                }}
              />
              {t('web.maintenance.offerReplace')}
            </label>
          )}

          <div className="space-y-xs">
            <Label htmlFor="close-notes">{t('web.maintenance.notes')}</Label>
            <Input id="close-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error ? <p className="t-caption text-danger">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('web.common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!canMutate || mutation.isPending || !canClose}
            onClick={() => void submit()}
          >
            {t('web.maintenance.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
