'use client';

import { useTranslations } from 'next-intl';

import { DateText } from '@/components/common/date-text';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { DetailSkeleton } from '@/components/feedback/skeletons';

import { useSyncStatus } from '../hooks';

export function SyncMonitorPage() {
  const t = useTranslations();
  const query = useSyncStatus();

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error || !query.data) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="space-y-md">
      <PageHeader title={t('web.organization.sync')} subtitle={t('web.organization.syncSubtitle')} />
      <p className="t-caption text-text-secondary">{t('web.organization.syncReadOnly')}</p>
      <dl className="grid max-w-lg gap-md rounded-md border border-border bg-surface p-md sm:grid-cols-2">
        <div>
          <dt className="t-caption text-text-secondary">{t('web.organization.serverTime')}</dt>
          <dd>
            <DateText value={query.data.serverTime} />
          </dd>
        </div>
        <div>
          <dt className="t-caption text-text-secondary">{t('web.organization.schemaVersion')}</dt>
          <dd className="t-mono" dir="ltr">
            {query.data.schemaVersion}
          </dd>
        </div>
      </dl>
      <p className="rounded-md border border-warning/40 bg-warning-surface p-md t-body text-warning">
        {t('web.organization.syncLimited')}
      </p>
    </div>
  );
}
