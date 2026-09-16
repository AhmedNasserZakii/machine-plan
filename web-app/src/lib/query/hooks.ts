'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { z } from 'zod';

import { usePathname, useRouter } from '@/i18n/navigation';
import type { Schema } from '@/lib/api/types';
import { omitDefaults, parseSearchParams, resetPageOnFilterChange } from '@/lib/query/url-state';

export function useUrlFilters<S extends z.ZodTypeAny>(schema: S, defaults: z.infer<S>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const values = useMemo(() => {
    const parsed = parseSearchParams(searchParams, schema);
    return { ...defaults, ...parsed } as z.infer<S>;
  }, [defaults, schema, searchParams]);

  const setValues = useCallback(
    (patch: Partial<z.infer<S>>) => {
      const next = resetPageOnFilterChange(values, patch, defaults);
      const omitted = omitDefaults(next as Record<string, unknown>, defaults as Record<string, unknown>);
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(omitted)) {
        if (Array.isArray(value)) {
          for (const item of value) params.append(key, String(item));
        } else if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [defaults, pathname, router, values],
  );

  const reset = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  return [values, setValues, reset] as const;
}

export type ReportJob = Schema<'ReportJobResponse'>;

export const exportJobKeys = {
  all: ['reports', 'jobs'] as const,
  detail: (id: string) => ['reports', 'job', id] as const,
};

const POLL_MS = 2_000;
const POLL_CAP_MS = 5 * 60_000;

function isTerminalStatus(status: ReportJob['status'] | undefined): boolean {
  return status === 'READY' || status === 'FAILED';
}

export function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function useExportJob(jobId: string | null, startedAt?: number) {
  return useQuery({
    queryKey: jobId ? exportJobKeys.detail(jobId) : (['reports', 'job', 'idle'] as const),
    enabled: Boolean(jobId),
    queryFn: async (): Promise<ReportJob | null> => {
      const { api } = await import('@/lib/api/client');
      const { endpoints } = await import('@/lib/api/endpoints');
      if (!jobId) return null;
      const result = await api.get<ReportJob>(endpoints.reports.job(jobId));
      return result.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (isTerminalStatus(status)) return false;
      const origin = startedAt ?? query.state.dataUpdatedAt;
      if (origin > 0 && Date.now() - origin >= POLL_CAP_MS) return false;
      return POLL_MS;
    },
  });
}

export function exportPollTimedOut(startedAt: number, status: ReportJob['status'] | undefined): boolean {
  if (isTerminalStatus(status)) return false;
  return Date.now() - startedAt >= POLL_CAP_MS;
}
