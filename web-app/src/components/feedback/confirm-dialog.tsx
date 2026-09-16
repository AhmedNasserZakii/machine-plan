'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode,useEffect, useState } from 'react';

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
import { useCanMutate } from '@/lib/network/use-online';

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When set, user must type this exact string to enable confirm. */
  confirmText?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmText,
  destructive = false,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations();
  const canMutate = useCanMutate();
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const typedOk = confirmText ? typed === confirmText : true;
  const disabled = pending || !typedOk || !canMutate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {confirmText ? (
          <div className="space-y-xs">
            <Label htmlFor="confirm-typed">{t('web.confirm.typeToConfirm', { text: confirmText })}</Label>
            <Input
              id="confirm-typed"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              dir="auto"
            />
          </div>
        ) : null}
        {!canMutate ? (
          <p className="t-caption text-danger" role="status">
            {t('web.shell.offline')}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t('shared.cancel')}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={disabled}
            onClick={() => void onConfirm()}
          >
            {confirmLabel ?? t('shared.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
