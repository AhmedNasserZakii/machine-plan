'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { SerialText } from '@/components/common/serial-text';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { ErrorCode } from '@/lib/api/error-codes';

import { useDeactivateUserMutation, useUserCustody } from '../hooks';
import type { User } from '../model';

type Props = {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeactivateUserDialog({ user, open, onOpenChange }: Props) {
  const t = useTranslations();
  const mutation = useDeactivateUserMutation(user.id);
  const custody = useUserCustody(user.id, { page: 1, limit: 50 });
  const [block, setBlock] = useState<'custody' | 'lastDirector' | null>(null);

  const confirm = async () => {
    setBlock(null);
    try {
      await mutation.mutateAsync();
      toast.success(t('web.users.deactivated'));
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.code === ErrorCode.USER_HAS_CUSTODY) {
        setBlock('custody');
        return;
      }
      if (error instanceof ApiError && error.code === ErrorCode.LAST_DIRECTOR) {
        setBlock('lastDirector');
        return;
      }
      toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
    }
  };

  if (block === 'lastDirector') {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setBlock(null);
            onOpenChange(false);
          }
        }}
        title={t('web.users.lastDirectorTitle')}
        description={t('web.users.lastDirectorBody')}
        confirmLabel={t('web.common.close')}
        onConfirm={() => {
          setBlock(null);
          onOpenChange(false);
        }}
      />
    );
  }

  if (block === 'custody') {
    const machines = custody.data?.machines ?? [];
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setBlock(null);
            onOpenChange(false);
          }
        }}
        title={t('web.users.hasCustodyTitle')}
        description={
          <div className="space-y-sm">
            <p>{t('web.users.hasCustodyBody', { count: machines.length || custody.data?.summary.totalMachines || 0 })}</p>
            <ul className="max-h-48 space-y-xs overflow-y-auto">
              {machines.map((m) => (
                <li key={m.id}>
                  <Link href={`/machines/${m.id}`} className="text-primary hover:underline">
                    <SerialText value={m.serial} />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/transfers/new" className="text-primary hover:underline">
              {t('web.users.handoverLink')}
            </Link>
          </div>
        }
        confirmLabel={t('web.common.close')}
        onConfirm={() => {
          setBlock(null);
          onOpenChange(false);
        }}
      />
    );
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('web.users.deactivateTitle')}
      description={t('web.users.deactivateBody', { name: user.fullName })}
      confirmLabel={t('web.users.deactivate')}
      destructive
      pending={mutation.isPending}
      onConfirm={confirm}
    />
  );
}
