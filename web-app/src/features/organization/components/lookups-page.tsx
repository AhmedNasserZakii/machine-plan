'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { PageHeader } from '@/components/feedback/page-header';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import type { LookupTab } from '../model';
import { LookupTable } from './lookup-table';

const TABS: LookupTab[] = [
  'types',
  'models',
  'suppliers',
  'payment-methods',
  'maintenance-locations',
  'violation-types',
  'decommission-reasons',
];

export function LookupsPage() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as LookupTab | null;
  const tab = TABS.includes(tabParam as LookupTab) ? (tabParam as LookupTab) : 'types';

  const setTab = useCallback(
    (next: LookupTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'types') params.delete('tab');
      else params.set('tab', next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-md">
      <PageHeader title={t('web.organization.lookups')} subtitle={t('web.organization.lookupsSubtitle')} />
      <div className="flex flex-wrap gap-xs border-b border-border pb-sm">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              'rounded-sm px-sm py-xs t-label',
              tab === item ? 'bg-info-surface text-primary' : 'text-text-secondary hover:bg-surface-alt',
            )}
          >
            {t(`web.organization.lookupTabs.${item}` as 'web.organization.lookupTabs.types')}
          </button>
        ))}
      </div>
      <LookupTable tab={tab} />
    </div>
  );
}
