'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
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
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { ErrorCode } from '@/lib/api/error-codes';
import { useCanMutate } from '@/lib/network/use-online';

import { useDecommissionMachineMutation, useRevertDecommissionMutation } from '../hooks';

type DecommissionDialogProps = {
  machineId: string;
  serial: string;
  costRatio?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

export function DecommissionDialog({
  machineId,
  serial,
  costRatio,
  open,
  onOpenChange,
  onDone,
}: DecommissionDialogProps) {
  const t = useTranslations();
  const canMutate = useCanMutate();
  const mutation = useDecommissionMachineMutation(machineId);
  const [reasonId, setReasonId] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{
    code: string;
    href?: string;
    label?: string;
  } | null>(null);

  const reasons = useQuery({
    queryKey: ['lookups', 'decommission-reasons'],
    enabled: open,
    queryFn: async () => {
      const result = await api.get<{ id: string; name: string }[]>(
        endpoints.lookups.decommissionReasons,
        { limit: 100, isActive: true },
      );
      return Array.isArray(result.data) ? result.data : [];
    },
  });

  useEffect(() => {
    if (!open) {
      setReasonId('');
      setNotes('');
      setError(null);
      setBlocked(null);
      setConfirmOpen(false);
    }
  }, [open]);

  const runDecommission = async () => {
    setError(null);
    setBlocked(null);
    try {
      await mutation.mutateAsync({
        reasonId,
        notes: notes.trim(),
        decommissionedAt: new Date().toISOString(),
      });
      toast.success(t('web.maintenance.decommissioned'));
      setConfirmOpen(false);
      onOpenChange(false);
      onDone?.();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ErrorCode.MACHINE_NOT_IN_WAREHOUSE) {
          setBlocked({
            code: err.code,
            href: `/transfers/new?machineId=${machineId}`,
            label: t('web.maintenance.goTransfer'),
          });
          setConfirmOpen(false);
          return;
        }
        if (err.code === ErrorCode.OPEN_MAINTENANCE_ORDER) {
          setBlocked({
            code: err.code,
            href: `/maintenance?machineId=${machineId}`,
            label: t('web.maintenance.goMaintenance'),
          });
          setConfirmOpen(false);
          return;
        }
        if (err.code === ErrorCode.ALREADY_DECOMMISSIONED) {
          setBlocked({
            code: err.code,
            href: `/maintenance/decommissions?machineId=${machineId}`,
            label: t('web.maintenance.viewDecommission'),
          });
          setConfirmOpen(false);
          return;
        }
        setError(t(`errors.${err.code}` as 'errors.INTERNAL_ERROR'));
        setConfirmOpen(false);
        return;
      }
      setError(t('web.errors.generic'));
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open && !confirmOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('web.maintenance.decommissionTitle')}</DialogTitle>
            <DialogDescription>
              {t('web.maintenance.decommissionBody', {
                serial,
                ratio:
                  costRatio !== null && costRatio !== undefined
                    ? `${Math.round(costRatio * 100)}%`
                    : '—',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-md">
            <div className="space-y-xs">
              <Label htmlFor="dec-reason">{t('web.maintenance.decommissionReason')}</Label>
              <select
                id="dec-reason"
                className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body"
                value={reasonId}
                onChange={(e) => setReasonId(e.target.value)}
              >
                <option value="">{t('web.form.selectPlaceholder')}</option>
                {(reasons.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-xs">
              <Label htmlFor="dec-notes">{t('web.maintenance.notes')}</Label>
              <Input id="dec-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {blocked ? (
              <div className="space-y-xs rounded-md border border-warning bg-warning-surface p-md">
                <p className="t-body text-warning">
                  {t(`errors.${blocked.code}` as 'errors.INTERNAL_ERROR')}
                </p>
                {blocked.href && blocked.label ? (
                  <Link href={blocked.href} className="text-primary hover:underline">
                    {blocked.label}
                  </Link>
                ) : null}
              </div>
            ) : null}
            {error ? <p className="t-caption text-danger">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('web.common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canMutate || !reasonId || !notes.trim()}
              onClick={() => setConfirmOpen(true)}
            >
              {t('web.machines.decommission')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('web.maintenance.decommissionConfirmTitle')}
        description={t('web.maintenance.decommissionConfirmBody', {
          serial,
          ratio:
            costRatio !== null && costRatio !== undefined
              ? `${Math.round(costRatio * 100)}%`
              : '—',
        })}
        confirmText={serial}
        confirmLabel={t('web.machines.decommission')}
        destructive
        pending={mutation.isPending}
        onConfirm={runDecommission}
      />
    </>
  );
}

type RevertDecommissionDialogProps = {
  machineId: string;
  serial: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
};

export function RevertDecommissionDialog({
  machineId,
  serial,
  open,
  onOpenChange,
  onDone,
}: RevertDecommissionDialogProps) {
  const t = useTranslations();
  const mutation = useRevertDecommissionMutation(machineId);
  const [reason, setReason] = useState('');

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('');
        onOpenChange(next);
      }}
      title={t('web.maintenance.revertTitle')}
      description={
        <div className="space-y-sm">
          <p>{t('web.maintenance.revertBody', { serial })}</p>
          <div className="space-y-xs">
            <Label htmlFor="revert-reason">{t('web.maintenance.revertReason')}</Label>
            <Input
              id="revert-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
      }
      confirmText={serial}
      confirmLabel={t('web.maintenance.revert')}
      destructive
      pending={mutation.isPending}
      onConfirm={async () => {
        if (!reason.trim()) {
          toast.error(t('web.form.required'));
          throw new Error('required');
        }
        try {
          await mutation.mutateAsync({ reason: reason.trim() });
          toast.success(t('web.maintenance.reverted'));
          onOpenChange(false);
          setReason('');
          onDone?.();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t('web.errors.generic'));
          throw error;
        }
      }}
    />
  );
}
