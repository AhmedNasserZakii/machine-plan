'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { DetailSkeleton } from '@/components/feedback/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';

import type { Setting } from '../api/settings.api';
import { useSystemSettings, useUpdateSettingMutation } from '../hooks/use-settings';

const BUSINESS_RULE_KEYS = [
  'FINANCE_BACKDATE_LIMIT_DAYS',
  'TRANSFER_STUCK_THRESHOLD_HOURS',
  'TRANSFER_CANCEL_WINDOW_MINUTES',
  'IDLE_MACHINE_THRESHOLD_DAYS',
  'DECOMMISSION_COST_RATIO_CONSIDER',
];

export function SystemSettingsPage() {
  const t = useTranslations();
  const query = useSystemSettings();
  const mutation = useUpdateSettingMutation();
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data?.length) {
    return <EmptyState title={t('web.filters.emptyTitle')} description={t('web.settings.systemEmpty')} />;
  }

  const save = async (setting: Setting) => {
    const value = drafts[setting.key] ?? setting.value;
    try {
      await mutation.mutateAsync({ key: setting.key, body: { value } });
      toast.success(t('web.settings.settingSaved'));
      setConfirmKey(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('web.errors.generic'));
    }
  };

  return (
    <div className="space-y-md">
      <PageHeader title={t('web.settings.system')} subtitle={t('web.settings.systemSubtitle')} />
      <ul className="space-y-md">
        {query.data.map((setting) => {
          const needsConfirm = BUSINESS_RULE_KEYS.some((k) => setting.key.includes(k) || k.includes(setting.key));
          const value = drafts[setting.key] ?? setting.value;
          return (
            <li key={setting.key} className="space-y-sm rounded-md border border-border bg-surface p-md">
              <div className="flex flex-wrap items-start justify-between gap-sm">
                <div>
                  <p className="font-medium t-mono" dir="ltr">
                    {setting.key}
                  </p>
                  <p className="t-body text-text-secondary">{setting.description}</p>
                  <p className="t-caption text-text-secondary">
                    {t('web.settings.kind')}: {setting.kind} · {t('web.settings.range')}: {setting.min}–{setting.max}
                    {setting.isOverridden ? ` · ${t('web.settings.overridden')}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-sm">
                  <Input
                    type="number"
                    dir="ltr"
                    className="w-28"
                    value={value}
                    min={setting.min}
                    max={setting.max}
                    step={setting.kind === 'RATIO' ? 0.01 : 1}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [setting.key]: Number(e.target.value) }))
                    }
                  />
                  <Button
                    type="button"
                    disabled={mutation.isPending}
                    onClick={() => {
                      if (needsConfirm) setConfirmKey(setting.key);
                      else void save(setting);
                    }}
                  >
                    {t('web.form.save')}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={Boolean(confirmKey)}
        onOpenChange={(next) => {
          if (!next) setConfirmKey(null);
        }}
        title={t('web.settings.confirmBusinessRule')}
        description={t('web.settings.confirmBusinessRuleBody', { key: confirmKey ?? '' })}
        confirmLabel={t('web.form.save')}
        pending={mutation.isPending}
        onConfirm={async () => {
          const setting = query.data?.find((s) => s.key === confirmKey);
          if (setting) await save(setting);
        }}
      />
    </div>
  );
}
