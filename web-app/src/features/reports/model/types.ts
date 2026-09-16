import type { Schema } from '@/lib/api/types';

export type ReportCatalogueEntry = Schema<'ReportCatalogueEntryResponse'>;
export type ReportColumn = Schema<'ReportColumnResponse'>;
export type ReportResult = Schema<'ReportResponse'>;
export type ReportJob = Schema<'ReportJobResponse'>;

export type ReportKey = ReportCatalogueEntry['key'];
export type ReportFormat = 'csv' | 'xlsx' | 'pdf';
export type ReportCellType = ReportColumn['type'];

export type ReportJobAccepted = {
  jobId: string;
  status: ReportJob['status'];
  pollUrl: string;
};

export type ReportRow = Record<string, unknown>;

export type ReportQueryParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  groupBy?: string;
  days?: number;
  granularity?: string;
  machineId?: string;
  format?: 'json' | ReportFormat;
};

export type ReportDomain =
  | 'machines'
  | 'transfers'
  | 'people'
  | 'merchants'
  | 'maintenance'
  | 'finance';

export type FilterDef =
  | { type: 'dateRange' }
  | { type: 'branch' }
  | { type: 'groupBy'; options: readonly string[] }
  | { type: 'days'; defaults?: number }
  | { type: 'granularity' }
  | { type: 'machineId' };

export type ReportConfig = {
  slug: string;
  key: ReportKey;
  /** Path under `/api/v1/` — may include `{id}` for lifecycle. */
  endpoint: string;
  permission: string;
  domain: ReportDomain;
  filters: FilterDef[];
  view: 'table' | 'chart' | 'split';
  groupBy?: readonly string[];
  /** Side-by-side date ranges (finance + branch comparison). */
  comparison?: boolean;
  exportFormats: readonly ReportFormat[];
  descriptionKey: string;
};
