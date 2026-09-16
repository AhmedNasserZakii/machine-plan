'use client';

import { Pin, PinOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { TableSkeleton } from '@/components/feedback/table-skeleton';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import { formatRelative } from '@/lib/format';

import { useReportsCatalogue } from '../hooks';
import {
  getLastRunMap,
  getPinnedSlugs,
  togglePinnedSlug,
} from '../lib/pinning';
import {
  configByKey,
  type ReportCatalogueEntry,
  type ReportDomain,
  slugFromCataloguePath,
} from '../model';

const DOMAIN_ORDER: ReportDomain[] = [
  'machines',
  'transfers',
  'maintenance',
  'people',
  'merchants',
  'finance',
];

function domainLabelKey(domain: ReportDomain): string {
  switch (domain) {
    case 'machines':
      return 'shared.reports_machines_section';
    case 'transfers':
      return 'shared.reports_transfers_section';
    case 'people':
      return 'shared.reports_people_section';
    case 'merchants':
      return 'shared.reports_merchants_section';
    case 'maintenance':
      return 'shared.reports_maintenance_section';
    default:
      return 'shared.reports_finance_section';
  }
}

type HubCard = {
  slug: string;
  title: string;
  descriptionKey: string;
  domain: ReportDomain;
  permission: string;
};

function toCard(entry: ReportCatalogueEntry): HubCard | null {
  const config = configByKey(entry.key);
  const slug = config?.slug ?? slugFromCataloguePath(entry.path);
  if (!slug || !config) return null;
  return {
    slug,
    title: entry.title,
    descriptionKey: config.descriptionKey,
    domain: config.domain,
    permission: entry.permission || config.permission,
  };
}

export function ReportsHubPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { permissions } = useSession();
  const catalogue = useReportsCatalogue();
  const [pinned, setPinned] = useState<string[]>([]);
  const [lastRun, setLastRun] = useState<Record<string, string>>({});

  useEffect(() => {
    setPinned(getPinnedSlugs());
    setLastRun(getLastRunMap());
  }, []);

  const cards = useMemo(() => {
    const entries = catalogue.data ?? [];
    return entries
      .filter((e) => e.allowed && can(permissions, e.permission))
      .map(toCard)
      .filter((c): c is HubCard => c !== null);
  }, [catalogue.data, permissions]);

  const pinnedCards = cards.filter((c) => pinned.includes(c.slug));
  const byDomain = DOMAIN_ORDER.map((domain) => ({
    domain,
    items: cards.filter((c) => c.domain === domain && !pinned.includes(c.slug)),
  })).filter((g) => g.items.length > 0);

  const togglePin = (slug: string) => {
    setPinned(togglePinnedSlug(slug));
  };

  return (
    <div className="space-y-lg">
      <PageHeader
        title={t('shared.reports_title')}
        subtitle={t('web.reports.hubSubtitle')}
        actions={
          can(permissions, P.reportsExport) ? (
            <Link
              href="/reports/exports"
              className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-2.5 t-body hover:bg-surface-alt"
            >
              {t('web.reports.viewExports')}
            </Link>
          ) : null
        }
      />

      {catalogue.isLoading ? <TableSkeleton rows={6} /> : null}
      {catalogue.isError ? (
        <ErrorState error={catalogue.error} onRetry={() => void catalogue.refetch()} />
      ) : null}

      {!catalogue.isLoading && !catalogue.isError && cards.length === 0 ? (
        <EmptyState
          title={t('web.reports.emptyHubTitle')}
          description={t('web.reports.emptyHubBody')}
        />
      ) : null}

      {pinnedCards.length > 0 ? (
        <section className="space-y-sm">
          <h2 className="t-h3 text-text-primary">{t('web.reports.pinned')}</h2>
          <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-3">
            {pinnedCards.map((card) => (
              <ReportCard
                key={card.slug}
                card={card}
                pinned
                lastRun={lastRun[card.slug]}
                locale={locale}
                onTogglePin={() => togglePin(card.slug)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {byDomain.map((group) => (
        <section key={group.domain} className="space-y-sm">
          <h2 className="t-h3 text-text-primary">{t(domainLabelKey(group.domain))}</h2>
          <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((card) => (
              <ReportCard
                key={card.slug}
                card={card}
                pinned={false}
                lastRun={lastRun[card.slug]}
                locale={locale}
                onTogglePin={() => togglePin(card.slug)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ReportCard({
  card,
  pinned,
  lastRun,
  locale,
  onTogglePin,
}: {
  card: HubCard;
  pinned: boolean;
  lastRun?: string;
  locale: string;
  onTogglePin: () => void;
}) {
  const t = useTranslations();
  return (
    <article className="flex flex-col gap-sm rounded-md border border-border bg-surface p-md">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0 space-y-xs">
          <Link href={`/reports/${card.slug}`} className="t-h3 text-text-primary hover:underline">
            {card.title}
          </Link>
          <p className="t-caption text-text-secondary">{t(card.descriptionKey)}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onTogglePin}
          aria-label={pinned ? t('web.reports.unpin') : t('web.reports.pin')}
        >
          {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </Button>
      </div>
      <p className="t-caption text-text-placeholder">
        {lastRun
          ? t('web.reports.lastRun', {
              when: formatRelative(new Date(lastRun), locale),
            })
          : t('web.reports.neverRun')}
      </p>
    </article>
  );
}
