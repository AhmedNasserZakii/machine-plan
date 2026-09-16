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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { ErrorCode } from '@/lib/api/error-codes';
import { useCanMutate } from '@/lib/network/use-online';

import { useReplaceMachineMutation } from '../hooks';

type ReplaceMachineDialogProps = {
  machineId: string;
  machineSerial: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ReplaceMachineDialog({
  machineId,
  machineSerial,
  open,
  onOpenChange,
}: ReplaceMachineDialogProps) {
  const t = useTranslations();
  const router = useRouter();
  const canMutate = useCanMutate();
  const mutation = useReplaceMachineMutation(machineId);
  const [newSerial, setNewSerial] = useState('');
  const [newBattery, setNewBattery] = useState('');
  const [newSim, setNewSim] = useState('');
  const [hasBox, setHasBox] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNewSerial('');
      setNewBattery('');
      setNewSim('');
      setHasBox(false);
      setReason('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setError(null);
    if (!newSerial.trim() || !newBattery.trim() || !reason.trim()) {
      setError(t('web.form.required'));
      return;
    }
    try {
      const result = await mutation.mutateAsync({
        newSerial: newSerial.trim(),
        newBattery: { serial: newBattery.trim() },
        newSimSerial: newSim.trim() || undefined,
        hasBox,
        reason: reason.trim(),
        replacedAt: new Date().toISOString(),
      });
      toast.success(t('web.maintenance.replaced'));
      onOpenChange(false);
      router.push(`/machines/${result.newMachineId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ErrorCode.MACHINE_ALREADY_REPLACED) {
          setError(t('errors.MACHINE_ALREADY_REPLACED'));
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
          <DialogTitle>{t('web.maintenance.replaceTitle')}</DialogTitle>
          <DialogDescription>
            {t('web.maintenance.replaceBody', { serial: machineSerial })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-md">
          <div className="space-y-xs">
            <Label htmlFor="rep-serial">{t('web.maintenance.newSerial')}</Label>
            <Input
              id="rep-serial"
              dir="ltr"
              className="t-mono"
              value={newSerial}
              onChange={(e) => setNewSerial(e.target.value)}
            />
          </div>
          <div className="space-y-xs">
            <Label htmlFor="rep-battery">{t('web.machines.batterySerial')}</Label>
            <Input
              id="rep-battery"
              dir="ltr"
              className="t-mono"
              value={newBattery}
              onChange={(e) => setNewBattery(e.target.value)}
            />
          </div>
          <div className="space-y-xs">
            <Label htmlFor="rep-sim">{t('web.machines.simSerial')}</Label>
            <Input
              id="rep-sim"
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
            <Label htmlFor="rep-reason">{t('web.maintenance.replaceReason')}</Label>
            <Input id="rep-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error ? <p className="t-caption text-danger">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('web.common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!canMutate || mutation.isPending}
            onClick={() => void submit()}
          >
            {t('web.machines.replace')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
