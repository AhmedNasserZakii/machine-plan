'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations();
  const apiError = error instanceof ApiError ? error : null;
  const message = apiError?.message || t('web.errors.generic');
  const requestId = apiError?.requestId;

  return (
    <div role="alert" className="flex flex-col items-start gap-md rounded-md border border-border bg-surface p-lg">
      <p className="t-body">{message}</p>
      {requestId ? (
        <p className="t-mono t-caption text-text-secondary">
          {t('web.errors.requestId')}: {requestId}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ms-sm"
            onClick={() => navigator.clipboard.writeText(requestId)}
          >
            {t('web.errors.copyRequestId')}
          </Button>
        </p>
      ) : null}
      {onRetry ? (
        <Button type="button" onClick={onRetry}>
          {t('web.errors.retry')}
        </Button>
      ) : null}
    </div>
  );
}
