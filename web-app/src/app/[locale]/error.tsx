'use client';

import { useTranslations } from 'next-intl';

import { ErrorState } from '@/components/feedback/error-state';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="p-lg">
      <h1 className="mb-md t-h2">{t('web.errors.generic')}</h1>
      <ErrorState error={error} onRetry={reset} />
      {error.digest ? <p className="mt-sm t-mono t-caption">{error.digest}</p> : null}
    </div>
  );
}
