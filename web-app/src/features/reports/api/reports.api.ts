import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import type { QueryParams } from '@/lib/api/query';

import {
  type ReportCatalogueEntry,
  type ReportConfig,
  type ReportFormat,
  type ReportJob,
  type ReportJobAccepted,
  type ReportQueryParams,
  type ReportResult,
  resolveReportEndpoint,
} from '../model';

function toQuery(params: ReportQueryParams): QueryParams {
  return {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    branchId: params.branchId,
    groupBy: params.groupBy,
    days: params.days,
    granularity: params.granularity,
    format: params.format ?? 'json',
  };
}

export const reportsApi = {
  catalogue() {
    return api.get<ReportCatalogueEntry[]>(endpoints.reports.catalogue);
  },

  run(config: ReportConfig, params: ReportQueryParams = {}) {
    const path = resolveReportEndpoint(config, params.machineId);
    return api.get<ReportResult>(path, toQuery({ ...params, format: 'json' }));
  },

  /** Non-JSON format → 202 Accepted with `jobId`. */
  export(config: ReportConfig, params: ReportQueryParams, format: ReportFormat) {
    const path = resolveReportEndpoint(config, params.machineId);
    return api.get<ReportJobAccepted>(path, toQuery({ ...params, format }));
  },

  job(id: string) {
    return api.get<ReportJob>(endpoints.reports.job(id));
  },
};
