'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { LocaleSwitcher } from '@/components/common/locale-switcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from '@/i18n/navigation';
import { ErrorCode } from '@/lib/api/error-codes';
import type { Me } from '@/lib/api/types';
import { sessionKeys } from '@/lib/auth/use-session';
import { useOnline } from '@/lib/network/use-online';

const phoneRe = /^01[0125][0-9]{8}$/;

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const online = useOnline();
  const [reveal, setReveal] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [inactive, setInactive] = useState(false);
  const [, setTick] = useState(0);

  const schema = z.object({
    phone: z.string().regex(phoneRe, t('shared.invalid_phone_number')),
    password: z.string().min(1, t('shared.this_field_is_required')),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', password: '' },
  });

  useEffect(() => {
    if (!lockedUntil) return;
    const id = window.setInterval(() => {
      if (Date.now() >= lockedUntil) {
        setLockedUntil(null);
        form.clearErrors('root');
        return;
      }
      setTick((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [form, lockedUntil]);

  const onSubmit = form.handleSubmit(async (values) => {
    setInactive(false);
    if (!navigator.onLine) {
      form.setError('root', { message: t('errors.NETWORK_ERROR') });
      return;
    }
    try {
      const response = await fetch('/api/bff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; data?: Me; error?: { code?: string; message?: string } }
        | null;
      if (!response.ok) {
        const code = body?.error?.code;
        if (code === ErrorCode.ACCOUNT_INACTIVE) {
          setInactive(true);
          return;
        }
        if (code === ErrorCode.ACCOUNT_LOCKED || response.status === 429) {
          const retry = Number(response.headers.get('Retry-After') ?? 60);
          const seconds = Number.isFinite(retry) && retry > 0 ? retry : 60;
          setLockedUntil(Date.now() + seconds * 1000);
          const minutes = Math.max(1, Math.ceil(seconds / 60));
          form.setError('root', {
            message:
              code === ErrorCode.ACCOUNT_LOCKED
                ? t('errors.ACCOUNT_LOCKED', { minutes })
                : t('web.login.rateLimited', { seconds }),
          });
          return;
        }
        form.setError('root', {
          message: body?.error?.message ?? t(`errors.${ErrorCode.INVALID_CREDENTIALS}`),
        });
        return;
      }
      if (body?.data) {
        qc.setQueryData(sessionKeys.all, body.data);
      }
      if (body?.data?.mustChangePassword) {
        router.replace('/change-password');
        return;
      }
      const next = searchParams.get('next');
      router.replace(next && next.startsWith('/') ? next.replace(/^\/(ar|en)/, '') || '/' : '/');
    } catch {
      form.setError('root', { message: t('errors.NETWORK_ERROR') });
    }
  });

  if (inactive) {
    return (
      <div className="rounded-lg bg-surface p-xl shadow-card">
        <h1 className="t-h2">{t('web.login.inactiveTitle')}</h1>
        <p className="mt-sm t-body text-text-secondary">{t('web.login.inactiveBody')}</p>
      </div>
    );
  }

  const remaining = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)) : 0;

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-lg bg-surface p-xl shadow-card">
      <div className="mb-lg flex justify-end">
        <LocaleSwitcher />
      </div>
      <h1 className="t-h2">{t('shared.login_title')}</h1>
      <p className="mt-xs t-body text-text-secondary">{t('shared.login_subtitle')}</p>
      {searchParams.get('reason') === 'expired' ? (
        <p className="mt-md t-body text-danger" role="status">
          {t('web.shell.sessionExpired')}
        </p>
      ) : null}
      {!online ? (
        <p className="mt-md t-body text-danger" role="status">
          {t('errors.NETWORK_ERROR')}
        </p>
      ) : null}

      <div className="mt-lg space-y-md">
        <div>
          <Label htmlFor="phone">{t('web.login.phone')}</Label>
          <Input
            id="phone"
            dir="ltr"
            inputMode="tel"
            autoComplete="username"
            autoFocus
            className="mt-xs t-mono"
            {...form.register('phone')}
          />
          {form.formState.errors.phone ? (
            <p className="mt-xs t-caption text-danger">{form.formState.errors.phone.message}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="password">{t('web.login.password')}</Label>
          <div className="mt-xs flex gap-xs">
            <Input
              id="password"
              type={reveal ? 'text' : 'password'}
              autoComplete="current-password"
              className="flex-1"
              {...form.register('password')}
            />
            <Button type="button" variant="outline" onClick={() => setReveal((v) => !v)}>
              {reveal ? t('web.login.hidePassword') : t('web.login.showPassword')}
            </Button>
          </div>
        </div>
        {form.formState.errors.root ? (
          <p className="t-body text-danger" role="alert">
            {form.formState.errors.root.message}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting || remaining > 0 || !online}
        >
          {remaining > 0 ? t('web.login.rateLimited', { seconds: remaining }) : t('web.login.submit')}
        </Button>
        <p className="t-caption text-text-secondary">{t('web.login.noSignup')}</p>
      </div>
    </form>
  );
}
