import { EntityManager } from 'typeorm';

export const ReferencePrefix = {
  TRANSFER: 'TRF',
  MAINTENANCE: 'MNT',
  EXPENSE: 'EXP',
  INCOME: 'INC',
} as const;

export type ReferencePrefixValue = (typeof ReferencePrefix)[keyof typeof ReferencePrefix];

const ALLOWED_PREFIXES: readonly string[] = Object.values(ReferencePrefix);

/**
 * Sequence names already created in this process, so the `CREATE SEQUENCE` is attempted once
 * per prefix+year instead of on every reference number.
 *
 * The DDL is not free: it takes a lock, and inside a transaction that is a lock held for the
 * rest of it. Worse, running DDL inside the hand-off transaction means a failure there rolls
 * back the transfer rather than just the numbering.
 */
const ensured = new Set<string>();

/**
 * Generates the next human-readable reference number for a table, e.g. `TRF-2026-000141`.
 *
 * Uses a dedicated Postgres sequence per prefix+year so concurrent transactions never
 * collide (a `MAX(...) + 1` read would, under the monthly hand-off bursts this system sees).
 */
export async function nextReferenceNo(
  manager: EntityManager,
  prefix: string,
  now: Date = new Date(),
): Promise<string> {
  // The sequence name cannot be parameterized — it is an identifier, not a value — so the
  // prefix is checked against the known set instead of escaped. Anything else is a bug in
  // the caller, and refusing it here is what keeps this from becoming an injection point.
  if (!ALLOWED_PREFIXES.includes(prefix)) {
    throw new Error(`Unknown reference prefix: ${prefix}`);
  }

  const year = now.getUTCFullYear();
  const sequenceName = `seq_ref_${prefix.toLowerCase()}_${year}`;

  if (!ensured.has(sequenceName)) {
    await manager.query(`CREATE SEQUENCE IF NOT EXISTS ${sequenceName} START 1`);
    ensured.add(sequenceName);
  }

  const rows = await manager.query<Array<{ nextval: string }>>(
    `SELECT nextval('${sequenceName}') AS nextval`,
  );

  const value = Number(rows[0].nextval);
  return `${prefix}-${year}-${String(value).padStart(6, '0')}`;
}

/** Test seam: the memo is process-wide, and a fresh schema per test run invalidates it. */
export function resetReferenceSequenceCache(): void {
  ensured.clear();
}
