'use client';

import { useTranslations } from 'next-intl';

import { ErrorState } from '@/components/feedback/error-state';

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();
  return (
    <div>
      <h1 className="mb-md t-h2">{t('web.errors.generic')}</h1>
      <ErrorState error={error} onRetry={reset} />
    </div>
  );
}
