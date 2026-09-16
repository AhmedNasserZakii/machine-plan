'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { PageHeader } from '@/components/feedback/page-header';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export type DetailTab = {
  id: string;
  label: string;
  content: ReactNode;
};

type DetailPageScaffoldProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  tabs: DetailTab[];
  defaultTab?: string;
  summary?: ReactNode;
  className?: string;
};

export function DetailPageScaffold({
  title,
  subtitle,
  status,
  breadcrumbs,
  actions,
  tabs,
  defaultTab,
  summary,
  className,
}: DetailPageScaffoldProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = useMemo(() => {
    const fromUrl = searchParams.get('tab');
    if (fromUrl && tabs.some((tab) => tab.id === fromUrl)) return fromUrl;
    return defaultTab ?? tabs[0]?.id ?? '';
  }, [defaultTab, searchParams, tabs]);

  const setTab = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === (defaultTab ?? tabs[0]?.id)) params.delete('tab');
      else params.set('tab', id);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [defaultTab, pathname, router, searchParams, tabs],
  );

  const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className={cn('space-y-lg', className)}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        status={status}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />

      <div className="grid gap-lg lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        {summary ? (
          <aside
            className="order-first space-y-md rounded-md border border-border bg-surface p-md lg:order-last"
            aria-label={t('web.common.summary')}
          >
            {summary}
          </aside>
        ) : null}

        <div className="min-w-0 space-y-md">
          <div role="tablist" className="flex flex-wrap gap-xs border-b border-divider">
            {tabs.map((tab) => {
              const selected = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  id={`tab-${tab.id}`}
                  className={cn(
                    'border-b-2 px-md py-sm t-body transition-colors',
                    selected
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary',
                  )}
                  onClick={() => setTab(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div role="tabpanel" aria-labelledby={`tab-${current?.id}`}>
            {current?.content}
          </div>
        </div>
      </div>
    </div>
  );
}
