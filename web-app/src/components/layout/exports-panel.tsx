'use client';

import { useTranslations } from 'next-intl';

import { useExports } from '@/components/providers/exports-provider';
import { Button } from '@/components/ui/button';
import {
  asOptionalString,
  exportPollTimedOut,
  type ReportJob,
  useExportJob,
} from '@/lib/query/hooks';

function ExportJobRow({ id, startedAt }: { id: string; startedAt: number }) {
  const t = useTranslations();
  const { dismissJob } = useExports();
  const query = useExportJob(id, startedAt);
  const job = query.data;
  const timedOut = exportPollTimedOut(startedAt, job?.status);
  const downloadUrl = asOptionalString(job?.downloadUrl);
  const filename = asOptionalString(job?.filename) ?? id;

  return (
    <div className="flex items-start justify-between gap-md border-b border-border py-sm last:border-b-0">
      <div className="min-w-0">
        <p className="t-caption text-text-primary">{filename}</p>
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
      <div className="flex shrink-0 items-center gap-xs">
        {job?.status === 'READY' && downloadUrl ? (
          <a
            href={downloadUrl}
            className="t-caption text-primary underline-offset-2 hover:underline"
            download={filename}
          >
            {t('web.exports.download')}
          </a>
        ) : null}
        <Button type="button" variant="ghost" size="xs" onClick={() => dismissJob(id)}>
          {t('web.exports.dismiss')}
        </Button>
      </div>
    </div>
  );
}

export function ExportsPanel() {
  const t = useTranslations();
  const { jobs } = useExports();

  return (
    <section aria-label={t('web.shell.exports')} className="border-t border-border bg-surface">
      <div className="px-md py-sm">
        <p className="t-caption text-text-secondary">{t('web.shell.exports')}</p>
        {jobs.length === 0 ? (
          <p className="mt-xs t-caption text-text-placeholder">{t('web.exports.empty')}</p>
        ) : (
          <div className="mt-xs">
            {jobs.map((job) => (
              <ExportJobRow key={job.id} id={job.id} startedAt={job.startedAt} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export type { ReportJob };
