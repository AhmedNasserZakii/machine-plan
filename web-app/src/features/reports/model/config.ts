import { endpoints } from '@/lib/api/endpoints';
import { P } from '@/lib/auth/permissions';

import type { ReportConfig, ReportKey } from './types';

const EXPORT_ALL = ['csv', 'xlsx', 'pdf'] as const;
const GROUP_BY = ['representative', 'supervisor', 'branch', 'merchant', 'status', 'model'] as const;

/**
 * One config entry per report endpoint (`17`, `22`).
 * Hub tiles still come from `GET reports`; this drives the generic viewer.
 */
export const REPORT_CONFIGS: readonly ReportConfig[] = [
  {
    slug: 'machines-inventory',
    key: 'machine-inventory',
    endpoint: endpoints.reports.machinesInventory,
    permission: P.reportsMachines,
    domain: 'machines',
    filters: [{ type: 'dateRange' }, { type: 'branch' }],
    view: 'table',
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.machinesInventory',
  },
  {
    slug: 'machines-custody',
    key: 'machine-custody',
    endpoint: endpoints.reports.machinesCustody,
    permission: P.reportsMachines,
    domain: 'machines',
    filters: [{ type: 'branch' }, { type: 'groupBy', options: GROUP_BY }],
    view: 'table',
    groupBy: GROUP_BY,
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.machinesCustody',
  },
  {
    slug: 'machines-costs',
    key: 'machine-costs',
    endpoint: endpoints.reports.machinesCosts,
    permission: P.reportsMachines,
    domain: 'machines',
    filters: [{ type: 'dateRange' }, { type: 'branch' }],
    view: 'table',
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.machinesCosts',
  },
  {
    slug: 'machines-idle',
    key: 'machine-idle',
    endpoint: endpoints.reports.machinesIdle,
    permission: P.reportsMachines,
    domain: 'machines',
    filters: [{ type: 'branch' }, { type: 'days', defaults: 30 }],
    view: 'table',
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.machinesIdle',
  },
  {
    slug: 'machines-warranty',
    key: 'warranty-expiry',
    endpoint: endpoints.reports.machinesWarranty,
    permission: P.reportsMachines,
    domain: 'machines',
    filters: [{ type: 'branch' }, { type: 'days', defaults: 30 }],
    view: 'table',
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.machinesWarranty',
  },
  {
    slug: 'machines-lifecycle',
    key: 'machine-lifecycle',
    endpoint: 'reports/machines/{id}/lifecycle',
    permission: P.reportsMachines,
    domain: 'machines',
    filters: [{ type: 'machineId' }],
    view: 'table',
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.machinesLifecycle',
  },
  {
    slug: 'transfers',
    key: 'transfers-log',
    endpoint: endpoints.reports.transfers,
    permission: P.reportsTransfers,
    domain: 'transfers',
    filters: [{ type: 'dateRange' }, { type: 'branch' }],
    view: 'table',
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.transfers',
  },
  {
    slug: 'transfers-pending',
    key: 'transfers-pending',
    endpoint: endpoints.reports.transfersPending,
    permission: P.reportsTransfers,
    domain: 'transfers',
    filters: [{ type: 'branch' }],
    view: 'table',
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.transfersPending',
  },
  {
    slug: 'maintenance',
    key: 'maintenance-log',
    endpoint: endpoints.reports.maintenance,
    permission: P.maintenanceRead,
    domain: 'maintenance',
    filters: [{ type: 'dateRange' }, { type: 'branch' }],
    view: 'table',
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.maintenance',
  },
  {
    slug: 'violations',
    key: 'violations-register',
    endpoint: endpoints.reports.violations,
    permission: P.reportsViolations,
    domain: 'people',
    filters: [{ type: 'dateRange' }, { type: 'branch' }],
    view: 'split',
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.violations',
  },
  {
    slug: 'merchants',
    key: 'merchant-portfolio',
    endpoint: endpoints.reports.merchants,
    permission: P.merchantsRead,
    domain: 'merchants',
    filters: [{ type: 'branch' }],
    view: 'table',
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.merchants',
  },
  {
    slug: 'representatives',
    key: 'representative-performance',
    endpoint: endpoints.reports.representatives,
    permission: P.reportsViolations,
    domain: 'people',
    filters: [{ type: 'dateRange' }, { type: 'branch' }],
    view: 'table',
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.representatives',
  },
  {
    slug: 'branches-comparison',
    key: 'branch-comparison',
    endpoint: endpoints.reports.branchesComparison,
    permission: P.reportsFinance,
    domain: 'finance',
    filters: [{ type: 'dateRange' }],
    view: 'split',
    comparison: true,
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.branchesComparison',
  },
  {
    slug: 'finance-expenses',
    key: 'expenses-by-category',
    endpoint: endpoints.reports.financeExpenses,
    permission: P.reportsFinance,
    domain: 'finance',
    filters: [{ type: 'dateRange' }, { type: 'branch' }],
    view: 'split',
    comparison: true,
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.financeExpenses',
  },
  {
    slug: 'finance-income',
    key: 'income-by-category',
    endpoint: endpoints.reports.financeIncome,
    permission: P.reportsFinance,
    domain: 'finance',
    filters: [{ type: 'dateRange' }, { type: 'branch' }],
    view: 'split',
    comparison: true,
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.financeIncome',
  },
  {
    slug: 'finance-pnl',
    key: 'profit-loss',
    endpoint: endpoints.reports.financePnl,
    permission: P.reportsFinance,
    domain: 'finance',
    filters: [{ type: 'dateRange' }, { type: 'branch' }, { type: 'granularity' }],
    view: 'chart',
    comparison: true,
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.financePnl',
  },
  {
    slug: 'finance-budgets',
    key: 'budget-performance',
    endpoint: endpoints.reports.financeBudgets,
    permission: P.reportsFinance,
    domain: 'finance',
    filters: [{ type: 'dateRange' }, { type: 'branch' }],
    view: 'table',
    comparison: true,
    exportFormats: EXPORT_ALL,
    descriptionKey: 'web.reports.desc.financeBudgets',
  },
] as const;

const BY_SLUG = new Map(REPORT_CONFIGS.map((c) => [c.slug, c]));
const BY_KEY = new Map(REPORT_CONFIGS.map((c) => [c.key, c]));

/** Catalogue `path` → viewer slug (`22`). */
export function slugFromCataloguePath(path: string): string | null {
  const normalized = path.replace(/^\/api\/v1\//, '').replace(/^\//, '');
  const match = REPORT_CONFIGS.find(
    (c) => c.endpoint === normalized || c.endpoint.replace('{id}', '{id}') === normalized,
  );
  if (match) return match.slug;
  // Lifecycle path template
  if (/^reports\/machines\/[^/]+\/lifecycle$/.test(normalized) || normalized.includes('{id}/lifecycle')) {
    return 'machines-lifecycle';
  }
  return null;
}

export function configBySlug(slug: string): ReportConfig | undefined {
  return BY_SLUG.get(slug);
}

export function configByKey(key: ReportKey): ReportConfig | undefined {
  return BY_KEY.get(key);
}

export function resolveReportEndpoint(config: ReportConfig, machineId?: string): string {
  if (config.endpoint.includes('{id}')) {
    if (!machineId) throw new Error('machineId required');
    return endpoints.reports.machineLifecycle(machineId);
  }
  return config.endpoint;
}
