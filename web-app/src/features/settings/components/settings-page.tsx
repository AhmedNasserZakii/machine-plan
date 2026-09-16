'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { PhoneText } from '@/components/common/phone-text';
import { PageHeader } from '@/components/feedback/page-header';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { cn } from '@/lib/utils';

type Tab = 'profile' | 'security' | 'preferences';

const PREFS_KEY = 'machinery.web.preferences';

type ClientPrefs = {
  tableDensity: 'comfortable' | 'compact';
  landingPage: string;
};

function loadPrefs(): ClientPrefs {
  if (typeof window === 'undefined') return { tableDensity: 'comfortable', landingPage: '/' };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { tableDensity: 'comfortable', landingPage: '/' };
    return { tableDensity: 'comfortable', landingPage: '/', ...JSON.parse(raw) };
  } catch {
    return { tableDensity: 'comfortable', landingPage: '/' };
  }
}

export function SettingsPage() {
  const t = useTranslations();
  const { user, permissions } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as Tab | null) ?? 'profile';
  const [prefs, setPrefs] = useState<ClientPrefs>({ tableDensity: 'comfortable', landingPage: '/' });

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const setTab = useCallback(
    (next: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'profile') params.delete('tab');
      else params.set('tab', next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: t('web.settings.profile') },
    { id: 'security', label: t('web.settings.security') },
    { id: 'preferences', label: t('web.settings.preferences') },
  ];

  return (
    <div className="space-y-md">
      <PageHeader title={t('web.settings.title')} subtitle={t('web.settings.subtitle')} />
      <div className="flex flex-wrap gap-xs border-b border-border pb-sm">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-sm px-sm py-xs t-label',
              tab === item.id ? 'bg-info-surface text-primary' : 'text-text-secondary hover:bg-surface-alt',
            )}
          >
            {item.label}
          </button>
        ))}
        {can(permissions, P.settingsManage) ? (
          <Link
            href="/settings/system"
            className="rounded-sm px-sm py-xs t-label text-text-secondary hover:bg-surface-alt"
          >
            {t('web.settings.system')}
          </Link>
        ) : null}
        <Link
          href="/settings/notifications"
          className="rounded-sm px-sm py-xs t-label text-text-secondary hover:bg-surface-alt"
        >
          {t('web.settings.notifications')}
        </Link>
      </div>

      {tab === 'profile' ? (
        <dl className="grid max-w-lg gap-md rounded-md border border-border bg-surface p-md sm:grid-cols-2">
          <div>
            <dt className="t-caption text-text-secondary">{t('web.users.fullName')}</dt>
            <dd>{user?.fullName ?? '—'}</dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.users.phone')}</dt>
            <dd>{user?.phone ? <PhoneText value={user.phone} /> : '—'}</dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.users.role')}</dt>
            <dd>{user?.role.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="t-caption text-text-secondary">{t('web.users.branch')}</dt>
            <dd>{user?.branch?.name ?? '—'}</dd>
          </div>
        </dl>
      ) : null}

      {tab === 'security' ? (
        <div className="max-w-lg">
          <ChangePasswordForm forced={false} />
        </div>
      ) : null}

      {tab === 'preferences' ? (
        <div className="max-w-lg space-y-md rounded-md border border-border bg-surface p-md">
          <label className="block space-y-xs">
            <span className="t-caption text-text-secondary">{t('web.settings.tableDensity')}</span>
            <select
              className="h-9 w-full rounded-md border border-border bg-background px-sm"
              value={prefs.tableDensity}
              onChange={(e) => {
                const next = { ...prefs, tableDensity: e.target.value as ClientPrefs['tableDensity'] };
                setPrefs(next);
                localStorage.setItem(PREFS_KEY, JSON.stringify(next));
              }}
            >
              <option value="comfortable">{t('web.settings.densityComfortable')}</option>
              <option value="compact">{t('web.settings.densityCompact')}</option>
            </select>
          </label>
          <label className="block space-y-xs">
            <span className="t-caption text-text-secondary">{t('web.settings.landingPage')}</span>
            <input
              className="h-9 w-full rounded-md border border-border bg-background px-sm"
              dir="ltr"
              value={prefs.landingPage}
              onChange={(e) => {
                const next = { ...prefs, landingPage: e.target.value };
                setPrefs(next);
                localStorage.setItem(PREFS_KEY, JSON.stringify(next));
              }}
            />
          </label>
          <p className="t-caption text-text-secondary">{t('web.settings.prefsLocalOnly')}</p>
        </div>
      ) : null}
    </div>
  );
}
