import { AUTO_TRANSACTION_SOURCES, TransactionSource } from 'src/common/enums/finance.enum';

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` in UTC. Dates in the ledger are calendar days, not moments. */
export function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * How many days before `today` a transaction is dated. Negative means the future.
 *
 * Compared as dates rather than timestamps: a transaction entered at 23:00 for today is not
 * backdated, and treating it as a moment would make the answer depend on the server's clock hour.
 */
export function backdateDays(transactionDate: string, today: string): number {
  const dated = Date.parse(`${transactionDate}T00:00:00.000Z`);
  const now = Date.parse(`${today}T00:00:00.000Z`);

  return Math.round((now - dated) / DAY_MS);
}

export function isFutureDate(transactionDate: string, today: string): boolean {
  return backdateDays(transactionDate, today) < 0;
}

/**
 * Whether a manual row is still inside its correction window (`15`, rule 6). Measured from when
 * it was entered, not from the date it carries: the point is how long ago somebody typed it, and
 * a legitimately backdated entry deserves the same window as any other.
 */
export function isWithinEditWindow(createdAt: Date, windowDays: number, now: Date): boolean {
  return now.getTime() - createdAt.getTime() <= windowDays * DAY_MS;
}

/** A row owned by an origin record: reversed by reversing that record, never touched here. */
export function isAutoPosted(source: TransactionSource): boolean {
  return AUTO_TRANSACTION_SOURCES.includes(source);
}
