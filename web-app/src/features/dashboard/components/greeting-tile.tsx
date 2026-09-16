'use client';

import { useTranslations } from 'next-intl';

import { CardGridSkeleton } from '@/components/feedback/skeletons';
import { useSession } from '@/lib/auth/use-session';

export function GreetingTile() {
  const t = useTranslations();
  const { user, isLoading } = useSession();

  if (isLoading) {
    return <CardGridSkeleton count={1} className="grid-cols-1" />;
  }

  const role = user?.role?.name ?? '';
  const branch = user?.branch?.name;

  return (
    <section className="rounded-md border border-border bg-surface p-lg">
      <h1 className="t-h1">{t('web.shell.dashboardWelcome', { name: user?.fullName ?? '' })}</h1>
      <p className="mt-sm t-body text-text-secondary">
        {branch
          ? t('web.dashboard.greetingMeta', { role, branch })
          : t('web.dashboard.greetingMetaNoBranch', { role })}
      </p>
    </section>
  );
}
