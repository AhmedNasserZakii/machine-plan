'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';

import { useResetPasswordMutation } from '../hooks';
import { asText, generateTempPassword } from '../lib/value';

type Props = {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ResetPasswordDialog({ userId, open, onOpenChange }: Props) {
  const t = useTranslations();
  const mutation = useResetPasswordMutation(userId);
  const [custom, setCustom] = useState('');
  const [shownOnce, setShownOnce] = useState<string | null>(null);

  const run = async (password?: string) => {
    try {
      const result = await mutation.mutateAsync(password ? { newPassword: password } : {});
      const temp = asText(result?.temporaryPassword) ?? password ?? null;
      if (temp) {
        setShownOnce(temp);
        toast.success(t('web.users.resetPasswordSuccess'));
      } else {
        toast.success(t('web.users.resetPasswordSuccess'));
        onOpenChange(false);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
    }
  };

  if (shownOnce) {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setShownOnce(null);
            setCustom('');
            onOpenChange(false);
          }
        }}
        title={t('web.users.credentialsTitle')}
        description={
          <div className="space-y-sm">
            <p className="text-warning">{t('web.users.credentialsWarning')}</p>
            <bdi dir="ltr" className="block rounded-md bg-surface-alt p-sm t-mono">
              {shownOnce}
            </bdi>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(shownOnce);
                toast.success(t('web.users.copied'));
              }}
            >
              {t('web.users.copyPassword')}
            </Button>
          </div>
        }
        confirmLabel={t('web.users.credentialsAck')}
        onConfirm={() => {
          setShownOnce(null);
          setCustom('');
          onOpenChange(false);
        }}
      />
    );
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('web.users.resetPasswordTitle')}
      description={
        <div className="space-y-sm">
          <p>{t('web.users.resetPasswordBody')}</p>
          <div>
            <Label htmlFor="reset-password">{t('web.users.optionalPassword')}</Label>
            <div className="mt-xs flex gap-sm">
              <Input
                id="reset-password"
                dir="ltr"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder={t('web.users.serverGenerated')}
              />
              <Button type="button" variant="outline" onClick={() => setCustom(generateTempPassword())}>
                {t('web.users.generate')}
              </Button>
            </div>
          </div>
        </div>
      }
      confirmLabel={t('web.users.resetPassword')}
      pending={mutation.isPending}
      onConfirm={() => run(custom.trim() || undefined)}
    />
  );
}
