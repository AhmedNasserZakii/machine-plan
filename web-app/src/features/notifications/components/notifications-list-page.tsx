'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { z } from 'zod';

import { DateText } from '@/components/common/date-text';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/feedback/page-header';
import { BooleanFilter, FilterBar, SelectFilter } from '@/components/filter-bar/filter-bar';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { useUrlFilters } from '@/lib/query/hooks';

import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsList,
} from '../hooks';
import { notificationHref, type NotificationTemplate } from '../model';

const TEMPLATES: NotificationTemplate[] = [
  'TRANSFER_PENDING', 'TRANSFER_CONFIRMED', 'TRANSFER_REJECTED', 'TRANSFER_REMINDER', 'TRANSFER_STUCK',
  'VIOLATION_CREATED', 'VIOLATION_CHARGED', 'MAINTENANCE_OPENED', 'MAINTENANCE_RETURNED', 'MACHINE_REPLACED',
  'WARRANTY_EXPIRING', 'WARRANTY_EXPIRED', 'BUDGET_WARNING', 'BUDGET_EXCEEDED', 'SUBSCRIPTION_DUE',
  'SUBSCRIPTION_OVERDUE', 'MACHINE_IDLE', 'DECOMMISSION_CANDIDATE', 'MACHINE_DECOMMISSIONED', 'DIGEST',
];

const filtersSchema = z.object({
  unreadOnly: z.union([z.boolean(), z.string()]).optional(),
  templateCode: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

function asBool(value: boolean | string | undefined): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function NotificationsListPage() {
  const t = useTranslations();
  const [filters, setFilters, reset] = useUrlFilters(filtersSchema, { page: 1, limit: 30 });
  const unreadOnly = asBool(filters.unreadOnly);
  const listParams = useMemo(
    () => ({
      page: filters.page,
      limit: filters.limit,
      sortDir: 'desc' as const,
      unreadOnly: unreadOnly || undefined,
      templateCode: filters.templateCode
        ? ([filters.templateCode] as NotificationTemplate[])
        : undefined,
    }),
    [filters, unreadOnly],
  );
  const query = useNotificationsList(listParams);
  const markRead = useMarkNotificationReadMutation();
  const markAll = useMarkAllNotificationsReadMutation();

  const grouped = useMemo(() => {
    const rows = query.data?.data ?? [];
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = dayKey(row.createdAt);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [query.data]);

  const typeOptions = TEMPLATES.map((code) => ({
    value: code,
    label: t(`enums.notificationType.${code}` as 'enums.notificationType.DIGEST'),
  }));

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('web.notifications.title')}
        subtitle={t('web.notifications.subtitle')}
        actions={
          <Button type="button" variant="outline" disabled={markAll.isPending} onClick={() => void markAll.mutateAsync(undefined)}>
            {t('web.notifications.markAll')}
          </Button>
        }
      />
      <FilterBar state={filters} onChange={setFilters} onReset={reset} storageKey="notifications.filters">
        <BooleanFilter name="unreadOnly" label={t('web.notifications.unreadOnly')} />
        <SelectFilter name="templateCode" label={t('web.notifications.type')} options={typeOptions} />
      </FilterBar>

      {!grouped.length && !query.isLoading ? (
        <EmptyState title={t('web.notifications.empty')} description={t('web.notifications.emptyBody')} />
      ) : (
        <div className="space-y-lg">
          {grouped.map(([day, items]) => (
            <section key={day} className="space-y-sm">
              <h2 className="t-caption text-text-secondary">{day}</h2>
              <ul className="divide-y divide-border rounded-md border border-border">
                {items.map((n) => {
                  const href = notificationHref(n);
                  return (
                    <li key={n.id}>
                      <Link
                        href={href ?? '/notifications'}
                        className={
                          !n.isRead
                            ? 'flex flex-col gap-xs bg-info-surface/40 px-md py-sm hover:bg-surface-alt'
                            : 'flex flex-col gap-xs px-md py-sm hover:bg-surface-alt'
                        }
                        onClick={() => {
                          if (!n.isRead) void markRead.mutateAsync(n.id);
                        }}
                      >
                        <span className="flex items-center justify-between gap-sm">
                          <span className="font-medium">{n.title}</span>
                          <span className="t-caption text-text-secondary">
                            {t(`enums.notificationType.${n.templateCode}` as 'enums.notificationType.DIGEST')}
                          </span>
                        </span>
                        <span className="t-body text-text-secondary">{n.body}</span>
                        <DateText value={n.createdAt} className="t-caption text-text-secondary" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
