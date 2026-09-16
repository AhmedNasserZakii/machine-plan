'use client';

import { useTranslations } from 'next-intl';

import { useOnline } from '@/lib/network/use-online';

export function OfflineBanner() {
  const t = useTranslations();
  const online = useOnline();

  if (online) return null;

  return (
    <div
      role="status"
      className="bg-offline-banner px-md py-sm text-center text-text-on-primary t-label"
    >
      {t('web.shell.offline')}
    </div>
  );
}
