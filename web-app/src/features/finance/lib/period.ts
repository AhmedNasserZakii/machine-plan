import { addDaysIso, todayIsoDate } from './value';

export type FinancePeriodPreset = 'thisMonth' | 'lastMonth' | 'quarter' | 'year' | 'custom';

function startOfMonth(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
}

function endOfMonth(year: number, monthIndex: number): string {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return last.toISOString().slice(0, 10);
}

export function resolvePeriodRange(
  preset: FinancePeriodPreset,
  customFrom?: string,
  customTo?: string,
): { dateFrom: string; dateTo: string } {
  const today = todayIsoDate();
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (preset === 'custom') {
    return {
      dateFrom: customFrom || startOfMonth(y, m),
      dateTo: customTo || today,
    };
  }

  if (preset === 'thisMonth') {
    return { dateFrom: startOfMonth(y, m), dateTo: today };
  }

  if (preset === 'lastMonth') {
    const ly = m === 0 ? y - 1 : y;
    const lm = m === 0 ? 11 : m - 1;
    return { dateFrom: startOfMonth(ly, lm), dateTo: endOfMonth(ly, lm) };
  }

  if (preset === 'quarter') {
    const qStart = Math.floor(m / 3) * 3;
    return { dateFrom: startOfMonth(y, qStart), dateTo: today };
  }

  // year
  return { dateFrom: startOfMonth(y, 0), dateTo: today };
}

export function minAllowedTransactionDate(backdateLimitDays: number): string {
  return addDaysIso(todayIsoDate(), -backdateLimitDays);
}
