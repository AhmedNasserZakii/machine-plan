'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { reportsApi } from '../api/reports.api';
import type { ReportConfig, ReportFormat, ReportQueryParams } from '../model';
import { reportKeys } from './query-keys';

export function useReportsCatalogue() {
  return useQuery({
    queryKey: reportKeys.catalogue(),
    queryFn: async () => {
      const result = await reportsApi.catalogue();
      return result.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useReportQuery(
  config: ReportConfig | undefined,
  params: ReportQueryParams,
  enabled = true,
) {
  const needsMachine = config?.key === 'machine-lifecycle';
  return useQuery({
    queryKey: config ? reportKeys.run(config.slug, params) : (['reports', 'run', 'idle'] as const),
    enabled: Boolean(config) && enabled && (!needsMachine || Boolean(params.machineId)),
    queryFn: async () => {
      if (!config) throw new Error('missing report config');
      const result = await reportsApi.run(config, params);
      return result.data;
    },
    staleTime: 60_000,
  });
}

export function useReportExportMutation(config: ReportConfig) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { params: ReportQueryParams; format: ReportFormat }) => {
      const result = await reportsApi.export(config, vars.params, vars.format);
      return result.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reportKeys.jobs() });
    },
  });
}
