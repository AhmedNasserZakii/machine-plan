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
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { newIdempotencyKey } from '@/lib/api/idempotency';
import { useCanMutate } from '@/lib/network/use-online';

import type { MachineListItem } from '../model';

type RowProgress = {
  id: string;
  serial: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
};

type BulkMaintenanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machines: MachineListItem[];
  onDone?: () => void;
};

export function BulkMaintenanceDialog({
  open,
  onOpenChange,
  machines,
  onDone,
}: BulkMaintenanceDialogProps) {
  const t = useTranslations();
  const canMutate = useCanMutate();
  const [locationId, setLocationId] = useState('');
  const [fault, setFault] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RowProgress[]>([]);

  const locationsQuery = useQuery({
    queryKey: ['lookups', 'maintenance-locations'],
    enabled: open,
    queryFn: async () => {
      const result = await api.get<{ id: string; name: string }[]>(
        endpoints.lookups.maintenanceLocations,
        { limit: 100, isActive: true },
      );
      return Array.isArray(result.data) ? result.data : [];
    },
  });

  useEffect(() => {
    if (!open) {
      setLocationId('');
      setFault('');
      setRunning(false);
      setProgress([]);
    }
  }, [open]);

  const run = async () => {
    if (!locationId || !fault.trim() || !canMutate) return;
    setRunning(true);
    setProgress(
      machines.map((m) => ({
        id: m.id,
        serial: m.serial,
        status: 'pending',
      })),
    );

    let ok = 0;
    let fail = 0;

    for (const machine of machines) {
      setProgress((prev) =>
        prev.map((p) => (p.id === machine.id ? { ...p, status: 'running' } : p)),
      );
      try {
        await api.post(
          endpoints.maintenance.list,
          {
            machineId: machine.id,
            locationId,
            reportedFault: fault.trim(),
            sentAt: new Date().toISOString(),
          },
          newIdempotencyKey(),
        );
        ok += 1;
        setProgress((prev) =>
          prev.map((p) => (p.id === machine.id ? { ...p, status: 'success' } : p)),
        );
      } catch (error) {
        fail += 1;
        const message = error instanceof Error ? error.message : t('web.errors.generic');
        setProgress((prev) =>
          prev.map((p) =>
            p.id === machine.id ? { ...p, status: 'error', message } : p,
          ),
        );
      }
    }

    setRunning(false);
    if (fail === 0) {
      toast.success(t('web.machines.bulkMaintenanceAllOk', { count: ok }));
      onOpenChange(false);
    } else {
      toast.error(t('web.machines.bulkMaintenancePartial', { ok, fail }));
    }
    onDone?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return;
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={!running}>
        <DialogHeader>
          <DialogTitle>{t('web.machines.bulkMaintenanceTitle')}</DialogTitle>
          <DialogDescription>
            {t('web.machines.bulkMaintenanceBody', { count: machines.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-md">
          <div className="space-y-xs">
            <Label htmlFor="bulk-maint-location">{t('web.machines.maintenanceLocation')}</Label>
            <select
              id="bulk-maint-location"
              className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body"
              value={locationId}
              disabled={running}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">{t('web.form.selectPlaceholder')}</option>
              {(locationsQuery.data ?? []).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-xs">
            <Label htmlFor="bulk-maint-fault">{t('web.machines.reportedFault')}</Label>
            <Input
              id="bulk-maint-fault"
              value={fault}
              disabled={running}
              onChange={(e) => setFault(e.target.value)}
            />
          </div>
          {progress.length ? (
            <ul className="max-h-48 space-y-xs overflow-y-auto rounded-md border border-border p-sm">
              {progress.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-sm t-caption">
                  <bdi dir="ltr" className="t-mono">
                    {row.serial}
                  </bdi>
                  <span
                    className={
                      row.status === 'success'
                        ? 'text-success'
                        : row.status === 'error'
                          ? 'text-danger'
                          : 'text-text-secondary'
                    }
                  >
                    {row.status === 'pending'
                      ? t('web.machines.bulkRowPending')
                      : row.status === 'running'
                        ? t('web.machines.bulkRowRunning')
                        : row.status === 'success'
                          ? t('web.machines.bulkRowOk')
                          : (row.message ?? t('web.machines.bulkRowFail'))}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={running} onClick={() => onOpenChange(false)}>
            {t('web.common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={running || !locationId || !fault.trim() || !canMutate}
            onClick={() => void run()}
          >
            {t('web.machines.openMaintenance')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
