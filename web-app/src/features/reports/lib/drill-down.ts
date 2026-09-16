import type { ReportConfig, ReportRow } from '../model';

function asId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Best-effort drill-down. Several report rows omit entity ids (frozen API);
 * fall back to serial / reference search where that still lands on a useful screen.
 */
export function drillDownHref(
  config: ReportConfig,
  row: ReportRow,
  dateRange?: { dateFrom?: string; dateTo?: string },
): string | null {
  const qs = new URLSearchParams();
  if (dateRange?.dateFrom) qs.set('dateFrom', dateRange.dateFrom);
  if (dateRange?.dateTo) qs.set('dateTo', dateRange.dateTo);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';

  const id = asId(row.id);
  const machineId = asId(row.machineId) ?? id;
  const userId = asId(row.userId);
  const serial = asId(row.serial) ?? asId(row.currentSerial) ?? asId(row.originalSerial);
  const referenceNo = asId(row.referenceNo);

  switch (config.key) {
    case 'machine-inventory':
    case 'machine-idle':
    case 'machine-costs':
    case 'warranty-expiry':
      if (machineId) return `/machines/${machineId}${suffix}`;
      if (serial) return `/machines?search=${encodeURIComponent(serial)}`;
      return null;
    case 'machine-custody':
      if (asId(row.id)) return `/machines/${row.id as string}${suffix}`;
      if (serial) return `/machines?search=${encodeURIComponent(serial)}`;
      return null;
    case 'machine-lifecycle':
      return null;
    case 'transfers-log':
    case 'transfers-pending':
      if (id) return `/transfers/${id}`;
      if (referenceNo) return `/transfers?search=${encodeURIComponent(referenceNo)}`;
      return null;
    case 'violations-register':
      if (id) return `/violations/${id}`;
      if (serial) return `/machines?search=${encodeURIComponent(serial)}`;
      return null;
    case 'merchant-portfolio':
      if (id) return `/merchants/${id}`;
      return null;
    case 'maintenance-log':
      if (id) return `/maintenance/${id}`;
      if (serial) return `/machines?search=${encodeURIComponent(serial)}`;
      return null;
    case 'representative-performance':
      if (userId) return `/users/${userId}`;
      return null;
    case 'budget-performance':
      if (id) return `/finance/budgets/${id}`;
      return `/finance/budgets`;
    case 'expenses-by-category':
    case 'income-by-category':
    case 'profit-loss':
    case 'branch-comparison':
      return `/finance${suffix}`;
    default:
      return null;
  }
}
