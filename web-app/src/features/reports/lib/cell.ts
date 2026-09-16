import type { ReportCellType, ReportColumn, ReportRow } from '../model';

const MONEY_KEYS = new Set([
  'purchasePrice',
  'repairCost',
  'amount',
  'chargedAmount',
  'cost',
  'income',
  'expense',
  'net',
  'directTotal',
  'rolledTotal',
  'amountDue',
  'totalCollected',
  'spent',
  'remaining',
  'projectedTotal',
  'violationCharges',
  'maintenanceCost',
]);

export function isMoneyColumn(key: string): boolean {
  return MONEY_KEYS.has(key) || /(?:price|cost|amount|income|expense|total|spent)$/i.test(key);
}

export function cellValue(row: ReportRow, column: ReportColumn): unknown {
  return row[column.key];
}

export function formatCellPlain(
  value: unknown,
  type: ReportCellType,
  columnKey?: string,
): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object' && value !== null && 'name' in value) {
    return String((value as { name?: unknown }).name ?? '—');
  }
  if (type === 'number' && typeof value === 'number') {
    if (columnKey && isMoneyColumn(columnKey)) {
      return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value.toLocaleString();
  }
  if (type === 'date') {
    const s = String(value);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  return String(value);
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
