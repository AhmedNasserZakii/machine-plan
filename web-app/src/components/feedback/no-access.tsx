'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

export function NoAccess() {
  const t = useTranslations();
  return (
    <div className="mx-auto max-w-lg px-md py-xl text-center">
      <h1 className="t-h2">{t('web.shell.noAccessTitle')}</h1>
      <p className="mt-sm t-body text-text-secondary">{t('web.shell.noAccessBody')}</p>
      <Link
        href="/"
        className="mt-lg inline-flex rounded-md bg-primary px-md py-sm text-text-on-primary t-button"
      >
        {t('web.shell.backHome')}
      </Link>
    </div>
  );
}
