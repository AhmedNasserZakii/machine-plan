'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/navigation';
import { api,ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { ErrorCode } from '@/lib/api/error-codes';
import { newIdempotencyKey } from '@/lib/api/idempotency';
import { sessionKeys } from '@/lib/auth/use-session';
import { useCanMutate } from '@/lib/network/use-online';
import { cn } from '@/lib/utils';

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const qc = useQueryClient();
  const canMutate = useCanMutate();

  const schema = z
    .object({
      currentPassword: z.string().min(1, t('shared.this_field_is_required')),
      newPassword: z.string().min(8, t('shared.password_min_eight')),
      confirm: z.string().min(8, t('shared.password_min_eight')),
    })
    .refine((v) => v.newPassword === v.confirm, {
      path: ['confirm'],
      message: t('web.password.mismatch'),
    });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
    mode: 'onChange',
  });

  const newPassword = form.watch('newPassword');
  const ruleMinEight = (newPassword?.length ?? 0) >= 8;

  const onSubmit = form.handleSubmit(async (values) => {
    if (!canMutate) {
      form.setError('root', { message: t('web.shell.offline') });
      return;
    }
    try {
      await api.post(
        endpoints.auth.changePassword,
        { currentPassword: values.currentPassword, newPassword: values.newPassword },
        newIdempotencyKey(),
      );
      await qc.invalidateQueries({ queryKey: sessionKeys.all });
      toast.success(t('shared.change_password_success_message'));
      if (forced) router.replace('/');
      else form.reset();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : t(`errors.${ErrorCode.INVALID_CREDENTIALS}`);
      form.setError('currentPassword', { message });
    }
  });

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-lg bg-surface p-xl shadow-card">
      <h1 className="t-h2">{t('web.password.title')}</h1>
      {forced ? (
        <p className="mt-sm t-body text-text-secondary">{t('shared.change_password_required_subtitle')}</p>
      ) : null}
      <div className="mt-lg space-y-md">
        <div>
          <Label htmlFor="currentPassword">{t('web.password.current')}</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            className="mt-xs"
            {...form.register('currentPassword')}
          />
          {form.formState.errors.currentPassword ? (
            <p className="mt-xs t-caption text-danger">{form.formState.errors.currentPassword.message}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="newPassword">{t('web.password.new')}</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            className="mt-xs"
            {...form.register('newPassword')}
          />
          <ul className="mt-sm space-y-xs" aria-live="polite">
            <li
              className={cn(
                't-caption',
                ruleMinEight ? 'text-success' : 'text-text-secondary',
              )}
            >
              {ruleMinEight ? '✓' : '○'} {t('shared.password_min_eight')}
            </li>
          </ul>
          {form.formState.errors.newPassword ? (
            <p className="mt-xs t-caption text-danger">{form.formState.errors.newPassword.message}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="confirm">{t('web.password.confirm')}</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            className="mt-xs"
            {...form.register('confirm')}
          />
          {form.formState.errors.confirm ? (
            <p className="mt-xs t-caption text-danger">{form.formState.errors.confirm.message}</p>
          ) : null}
        </div>
        {form.formState.errors.root ? (
          <p className="t-body text-danger" role="alert">
            {form.formState.errors.root.message}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting || !canMutate}
        >
          {t('web.password.submit')}
        </Button>
      </div>
    </form>
  );
}
