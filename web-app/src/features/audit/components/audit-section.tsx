'use client';

import { useTranslations } from 'next-intl';

import { DateText } from '@/components/common/date-text';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { TableSkeleton } from '@/components/feedback/skeletons';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';

import { useEntityAudit } from '../hooks';
import { AuditDiff } from './audit-diff';

export function AuditSection({ entityType, entityId }: { entityType: string; entityId: string }) {
  const t = useTranslations();
  const { permissions } = useSession();
  const allowed = can(permissions, P.auditRead);
  const query = useEntityAudit(entityType, entityId, allowed);

  if (!allowed) return null;
  if (query.isLoading) return <TableSkeleton rows={4} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data?.length) {
    return <EmptyState title={t('web.audit.emptyTitle')} description={t('web.audit.emptyBody')} />;
  }

  return (
    <div className="space-y-md">
      <h3 className="t-h3">{t('web.audit.sectionTitle')}</h3>
      <ul className="space-y-md">
        {query.data.map((row) => (
          <li key={row.id} className="space-y-sm rounded-md border border-border p-md">
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <span className="font-medium">
                {t(`enums.auditAction.${row.action}` as 'enums.auditAction.LOGIN_SUCCESS')}
              </span>
              <DateText value={row.createdAt} />
            </div>
            <AuditDiff before={row.before} after={row.after} />
          </li>
        ))}
      </ul>
    </div>
  );
}
