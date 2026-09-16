'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';

import { useNotificationPreferences, useUpdateNotificationPreferencesMutation } from '../hooks';
import type { NotificationPreferences } from '../model';

export function NotificationPreferencesPage() {
  const t = useTranslations();
  const query = useNotificationPreferences();
  const mutation = useUpdateNotificationPreferencesMutation();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error || !draft) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('web.notifications.preferencesTitle')}
        subtitle={t('web.notifications.preferencesSubtitle')}
      />
      <p className="rounded-md border border-border bg-surface-alt p-md t-body">
        {t('web.notifications.channelsHonesty')}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {draft.preferences.map((pref, index) => (
          <li key={pref.templateCode} className="flex flex-wrap items-center justify-between gap-md px-md py-sm">
            <div>
              <p className="font-medium">
                {t(`enums.notificationType.${pref.templateCode}` as 'enums.notificationType.DIGEST')}
              </p>
              <p className="t-caption text-text-secondary" dir="ltr">
                {pref.templateCode}
              </p>
            </div>
            <div className="flex items-center gap-md">
              <label className="flex items-center gap-sm t-caption">
                <input
                  type="checkbox"
                  checked={pref.inApp}
                  disabled={pref.inAppLocked}
                  onChange={(e) => {
                    setDraft((prev) => {
                      if (!prev) return prev;
                      const preferences = prev.preferences.map((p, i) =>
                        i === index ? { ...p, inApp: e.target.checked } : p,
                      );
                      return { ...prev, preferences };
                    });
                  }}
                />
                {t('web.notifications.channelInApp')}
                {pref.inAppLocked ? ` (${t('web.notifications.locked')})` : ''}
              </label>
              <label className="flex items-center gap-sm t-caption">
                <input
                  type="checkbox"
                  checked={pref.push}
                  onChange={(e) => {
                    setDraft((prev) => {
                      if (!prev) return prev;
                      const preferences = prev.preferences.map((p, i) =>
                        i === index ? { ...p, push: e.target.checked } : p,
                      );
                      return { ...prev, preferences };
                    });
                  }}
                />
                {t('web.notifications.channelPush')}
              </label>
            </div>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        disabled={mutation.isPending}
        onClick={async () => {
          try {
            await mutation.mutateAsync({
              locale: draft.locale,
              preferences: draft.preferences.map((p) => ({
                templateCode: p.templateCode,
                push: p.push,
                inApp: p.inAppLocked ? undefined : p.inApp,
              })),
            });
            toast.success(t('web.notifications.preferencesSaved'));
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
          }
        }}
      >
        {t('web.form.save')}
      </Button>
    </div>
  );
}
