/** The report catalogue keys of `17-feature-reports.md`, one per endpoint. */
export enum ReportKey {
  MACHINE_INVENTORY = 'machine-inventory',
  MACHINE_CUSTODY = 'machine-custody',
  MACHINE_IDLE = 'machine-idle',
  MACHINE_LIFECYCLE = 'machine-lifecycle',
  MACHINE_COSTS = 'machine-costs',
  WARRANTY_EXPIRY = 'warranty-expiry',
  TRANSFERS_LOG = 'transfers-log',
  TRANSFERS_PENDING = 'transfers-pending',
  REPRESENTATIVE_PERFORMANCE = 'representative-performance',
  VIOLATIONS_REGISTER = 'violations-register',
  MERCHANT_PORTFOLIO = 'merchant-portfolio',
  MAINTENANCE_LOG = 'maintenance-log',
  EXPENSES_BY_CATEGORY = 'expenses-by-category',
  INCOME_BY_CATEGORY = 'income-by-category',
  PROFIT_LOSS = 'profit-loss',
  BUDGET_PERFORMANCE = 'budget-performance',
  BRANCH_COMPARISON = 'branch-comparison',
}

export const REPORT_KEYS = Object.values(ReportKey);

export enum ReportFormat {
  JSON = 'json',
  CSV = 'csv',
  XLSX = 'xlsx',
  PDF = 'pdf',
}

export const REPORT_FORMATS = Object.values(ReportFormat);

/** Everything but `json` leaves the request thread and comes back as a file (`17`). */
export const FILE_REPORT_FORMATS: readonly ReportFormat[] = [
  ReportFormat.CSV,
  ReportFormat.XLSX,
  ReportFormat.PDF,
];

export enum ReportJobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export const REPORT_JOB_STATUSES = Object.values(ReportJobStatus);

/** What `/reports/machines/custody?groupBy=` accepts. */
export enum CustodyGroupBy {
  REPRESENTATIVE = 'representative',
  SUPERVISOR = 'supervisor',
  BRANCH = 'branch',
  MERCHANT = 'merchant',
  STATUS = 'status',
  MODEL = 'model',
}

export const CUSTODY_GROUP_BY = Object.values(CustodyGroupBy);

/** The period buckets the profit-and-loss series is rolled into. */
export enum ReportGranularity {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

export const REPORT_GRANULARITIES = Object.values(ReportGranularity);
