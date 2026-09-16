'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { z } from 'zod';

import { DateText } from '@/components/common/date-text';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { FilterBar, SearchFilter, SelectFilter } from '@/components/filter-bar/filter-bar';
import { Button } from '@/components/ui/button';
import { useUrlFilters } from '@/lib/query/hooks';

import { useAuditInfinite } from '../hooks';
import type { AuditLog } from '../model';
import { AuditDiff } from './audit-diff';

const ENTITY_TYPES = [
  'machine', 'battery', 'merchant', 'user', 'role', 'branch', 'warehouse', 'transfer',
  'transfer_signature', 'maintenance_order', 'replacement', 'decommission',
  'finance_transaction', 'budget', 'finance_category', 'violation', 'auth', 'finance',
] as const;

const filtersSchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  requestId: z.string().optional(),
});

export function AuditLogPage() {
  const t = useTranslations();
  const [filters, setFilters, reset] = useUrlFilters(filtersSchema, {});
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useAuditInfinite({
    userId: filters.userId,
    action: filters.action as AuditLog['action'] | undefined,
    entityType: filters.entityType as AuditLog['entityType'] & string | undefined,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    requestId: filters.requestId,
    limit: 30,
  });

  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.data ?? []) ?? [], [query.data]);

  const entityOptions = ENTITY_TYPES.map((e) => ({
    value: e,
    label: t(`web.audit.entityTypes.${e}` as 'web.audit.entityTypes.machine'),
  }));

  return (
    <div className="space-y-md">
      <PageHeader title={t('web.audit.title')} subtitle={t('web.audit.subtitle')} />
      <FilterBar state={filters} onChange={setFilters} onReset={reset} storageKey="audit.filters">
        <SearchFilter name="userId" placeholder={t('web.audit.userId')} />
        <SelectFilter name="entityType" label={t('web.audit.entityType')} options={entityOptions} />
        <SearchFilter name="action" placeholder={t('web.audit.action')} />
        <SearchFilter name="requestId" placeholder={t('web.audit.requestId')} />
      </FilterBar>

      {query.isLoading ? (
        <TableSkeleton rows={8} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !rows.length ? (
        <EmptyState title={t('web.audit.emptyTitle')} description={t('web.audit.emptyBody')} />
      ) : (
        <ul className="space-y-sm">
          {rows.map((row) => {
            const open = expanded === row.id;
            return (
              <li key={row.id} className="rounded-md border border-border bg-surface">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-sm px-md py-sm text-start hover:bg-surface-alt"
                  onClick={() => setExpanded(open ? null : row.id)}
                >
                  <div>
                    <p className="font-medium">
                      {t(`enums.auditAction.${row.action}` as 'enums.auditAction.LOGIN_SUCCESS')}
                    </p>
                    <p className="t-caption text-text-secondary">
                      {row.entityType ?? '—'} · {typeof row.entityId === 'string' ? row.entityId : '—'}
                    </p>
                  </div>
                  <DateText value={row.createdAt} />
                </button>
                {open ? (
                  <div className="space-y-sm border-t border-border p-md">
                    <dl className="grid gap-sm sm:grid-cols-3 t-caption">
                      <div>
                        <dt className="text-text-secondary">{t('web.audit.actor')}</dt>
                        <dd dir="ltr">{typeof row.userId === 'string' ? row.userId : '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-text-secondary">{t('web.audit.ip')}</dt>
                        <dd dir="ltr">{typeof row.ipAddress === 'string' ? row.ipAddress : '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-text-secondary">{t('web.audit.requestId')}</dt>
                        <dd dir="ltr">{typeof row.requestId === 'string' ? row.requestId : '—'}</dd>
                      </div>
                    </dl>
                    <AuditDiff before={row.before} after={row.after} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {query.hasNextPage ? (
        <Button type="button" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          {t('web.audit.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
