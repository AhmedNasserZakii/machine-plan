const DAY_MS = 24 * 60 * 60 * 1000;

export enum BudgetStatus {
  OK = 'OK',
  WARNING = 'WARNING',
  EXCEEDED = 'EXCEEDED',
}

export const BUDGET_STATUSES = Object.values(BudgetStatus);

export const DEFAULT_ALERT_THRESHOLD_PERCENT = 80;

/** Escalation order. An alert is only worth sending when it moves up this list (`16`). */
const LEVEL_RANK: Record<BudgetStatus, number> = {
  [BudgetStatus.OK]: 0,
  [BudgetStatus.WARNING]: 1,
  [BudgetStatus.EXCEEDED]: 2,
};

export function usedPercentOf(spent: number, amount: number): number {
  if (amount <= 0) return 0;
  return (spent / amount) * 100;
}

/**
 * Judged on the unrounded percentage: a budget at 99.96% is not yet exceeded, and rounding it to
 * 100.0 for the screen must not be what decides that.
 */
export function budgetStatusOf(usedPercent: number, alertThresholdPercent: number): BudgetStatus {
  if (usedPercent >= 100) return BudgetStatus.EXCEEDED;
  if (usedPercent >= alertThresholdPercent) return BudgetStatus.WARNING;
  return BudgetStatus.OK;
}

/**
 * The level to announce, or null for silence.
 *
 * Only an upward move is announced. Without that rule every transaction booked after 80% would
 * notify the Director again, and the alert that mattered would be lost in the ones that did not.
 * A budget that falls back below a threshold — because a transaction was voided — stays silent
 * and keeps its recorded level, so the same warning is not sent twice for the same period.
 */
export function escalationOf(
  recordedLevel: string | null,
  currentStatus: BudgetStatus,
): BudgetStatus | null {
  const recorded = isBudgetStatus(recordedLevel) ? recordedLevel : BudgetStatus.OK;

  return LEVEL_RANK[currentStatus] > LEVEL_RANK[recorded] ? currentStatus : null;
}

export function isBudgetStatus(value: string | null): value is BudgetStatus {
  return value !== null && value in LEVEL_RANK;
}

export interface BudgetPeriodProgress {
  daysElapsed: number;
  daysTotal: number;
  elapsedPercent: number;
}

/**
 * How far through the period we are, counting the current day as elapsed — day 1 of a month is
 * one day spent, not zero, and treating it as zero makes the projection below divide by nothing.
 *
 * Clamped at both ends so a period that has not started reads as one day in and a finished one
 * reads as complete, rather than producing a negative pace or a percentage over 100.
 */
export function periodProgressOf(
  periodStart: string,
  periodEnd: string,
  asOf: string,
): BudgetPeriodProgress {
  const start = Date.parse(`${periodStart}T00:00:00.000Z`);
  const end = Date.parse(`${periodEnd}T00:00:00.000Z`);
  const now = Date.parse(`${asOf}T00:00:00.000Z`);

  const daysTotal = Math.floor((end - start) / DAY_MS) + 1;
  const elapsed = Math.floor((now - start) / DAY_MS) + 1;
  const daysElapsed = Math.min(Math.max(elapsed, 1), daysTotal);

  return {
    daysElapsed,
    daysTotal,
    elapsedPercent: round((daysElapsed / daysTotal) * 100, 1),
  };
}

export interface BudgetPace {
  expectedSpendByNow: number;
  overPaceBy: number;
  projectedTotal: number;
}

/**
 * What makes a budget actionable. "91% used" is a fact; "91% used on day 7 of 30, heading for
 * 117,000 against a 30,000 limit" is a decision, and it is the second one a Director needs.
 */
export function paceOf(amount: number, spent: number, progress: BudgetPeriodProgress): BudgetPace {
  const share = progress.daysElapsed / progress.daysTotal;
  const expected = amount * share;

  return {
    expectedSpendByNow: round(expected, 2),
    overPaceBy: round(spent - expected, 2),
    projectedTotal: round(spent / share, 2),
  };
}

/** Two closed date ranges overlap unless one ends before the other begins. */
export function periodsOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
): boolean {
  return firstStart <= secondEnd && secondStart <= firstEnd;
}

export function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
