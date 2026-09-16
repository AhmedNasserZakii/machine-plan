'use client';

import { useTranslations } from 'next-intl';

import { DateText } from '@/components/common/date-text';
import { EmptyState } from '@/components/feedback/empty-state';
import { NoAccess } from '@/components/feedback/no-access';
import { PageHeader } from '@/components/feedback/page-header';
import { useExports } from '@/components/providers/exports-provider';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { can } from '@/lib/auth/can';
import { P } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/use-session';
import {
  asOptionalString,
  exportPollTimedOut,
  useExportJob,
} from '@/lib/query/hooks';

function formatBytes(size: unknown): string {
  if (typeof size !== 'number' || !Number.isFinite(size)) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function ExportJobListRow({
  id,
  startedAt,
  reportKey,
  format,
}: {
  id: string;
  startedAt: number;
  reportKey?: string;
  format?: string;
}) {
  const t = useTranslations();
  const { dismissJob } = useExports();
  const query = useExportJob(id, startedAt);
  const job = query.data;
  const timedOut = exportPollTimedOut(startedAt, job?.status);
  const downloadUrl = asOptionalString(job?.downloadUrl);
  const filename = asOptionalString(job?.filename) ?? reportKey ?? id;

  return (
    <li className="flex flex-wrap items-start justify-between gap-md border-b border-border py-md last:border-b-0">
      <div className="min-w-0 space-y-xs">
        <p className="t-body text-text-primary">{filename}</p>
        <p className="t-caption text-text-secondary">
          {[reportKey, format?.toUpperCase(), formatBytes(job?.sizeBytes)]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="t-caption text-text-secondary">
          <DateText value={new Date(startedAt).toISOString()} format="datetime" />
        </p>
        <p className="t-caption text-text-secondary">
          {job?.status === 'READY'
            ? t('web.exports.ready')
            : job?.status === 'FAILED'
              ? t('web.exports.failed')
              : timedOut
                ? t('web.exports.timedOut')
                : t('web.exports.running')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-sm">
        {job?.status === 'READY' && downloadUrl ? (
          <a
            href={downloadUrl}
            className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 t-body text-primary-foreground"
            download={filename}
          >
            {t('web.exports.download')}
          </a>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={() => dismissJob(id)}>
          {t('web.exports.dismiss')}
        </Button>
      </div>
    </li>
  );
}

export function ReportExportsPage() {
  const t = useTranslations();
  const { permissions } = useSession();
  const { jobs } = useExports();

  if (!can(permissions, P.reportsExport)) {
    return <NoAccess />;
  }

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('web.reports.exportsTitle')}
        subtitle={t('web.reports.exportsSubtitle')}
        breadcrumbs={
          <nav className="t-caption text-text-secondary" aria-label={t('web.common.breadcrumbs')}>
            <Link href="/reports" className="hover:underline">
              {t('shared.reports')}
            </Link>
            <span aria-hidden> / </span>
            <span>{t('web.reports.exportsTitle')}</span>
          </nav>
        }
      />

      {jobs.length === 0 ? (
        <EmptyState
          title={t('web.reports.noExportsTitle')}
          description={t('web.reports.noExportsBody')}
          action={
            <Link
              href="/reports"
              className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 t-body text-primary-foreground"
            >
              {t('shared.reports')}
            </Link>
          }
        />
      ) : (
        <ul className="rounded-md border border-border bg-surface px-md">
          {[...jobs].reverse().map((job) => (
            <ExportJobListRow
              key={job.id}
              id={job.id}
              startedAt={job.startedAt}
              reportKey={job.reportKey}
              format={job.format}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
