'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { useExports } from '@/components/providers/exports-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { P } from '@/lib/auth/permissions';

import { useReportExportMutation } from '../hooks';
import { recordExportStarted, remainingExports } from '../lib/export-rate';
import type { ReportConfig, ReportFormat, ReportQueryParams } from '../model';

type ReportExportMenuProps = {
  config: ReportConfig;
  params: ReportQueryParams;
};

export function ReportExportMenu({ config, params }: ReportExportMenuProps) {
  const t = useTranslations();
  const { trackJob } = useExports();
  const mutation = useReportExportMutation(config);
  const [remaining, setRemaining] = useState(remainingExports);
  const [retryIn, setRetryIn] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(remainingExports());
  }, [mutation.isSuccess]);

  useEffect(() => {
    if (retryIn === null || retryIn <= 0) return;
    const id = window.setInterval(() => {
      setRetryIn((s) => (s === null || s <= 1 ? null : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [retryIn]);

  const start = async (format: ReportFormat) => {
    try {
      const accepted = await mutation.mutateAsync({ params, format });
      const jobId = accepted.jobId;
      if (jobId) {
        trackJob(jobId, { reportKey: config.key, format });
        recordExportStarted();
        setRemaining(remainingExports());
        toast.success(t('web.reports.exportStarted'));
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        const seconds = error.retryAfterSeconds ?? 60;
        setRetryIn(seconds);
        toast.error(t('web.reports.exportRateLimited', { seconds }));
        return;
      }
      toast.error(error instanceof Error ? error.message : t('web.errors.generic'));
    }
  };

  return (
    <Can perm={P.reportsExport}>
      <div className="flex flex-wrap items-center gap-sm">
        <p className="t-caption text-text-secondary">
          {t('web.reports.exportsRemaining', { count: remaining })}
        </p>
        {retryIn !== null ? (
          <p className="t-caption text-warning" role="status">
            {t('web.reports.retryAfter', { seconds: retryIn })}
          </p>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="outline" disabled={mutation.isPending || retryIn !== null}>
                {t('web.reports.export')}
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {config.exportFormats.map((format) => (
              <DropdownMenuItem key={format} onClick={() => void start(format)}>
                {format.toUpperCase()}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Link
          href="/reports/exports"
          className="t-caption text-primary underline-offset-2 hover:underline"
        >
          {t('web.reports.viewExports')}
        </Link>
      </div>
    </Can>
  );
}
