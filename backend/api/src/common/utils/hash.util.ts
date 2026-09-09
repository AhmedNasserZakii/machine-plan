import { createHash } from 'node:crypto';

/**
 * Stable SHA-256 of an object: keys are sorted recursively so two logically identical
 * payloads always hash the same. Used for transfer signature `payload_hash` and for
 * idempotency request hashes.
 */
export function sha256Object(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Stable JSON serialization: keys are sorted recursively so two logically identical objects
 * always produce the same string. Exported for equality comparisons (audit diffing) as well as
 * hashing.
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);

  return `{${entries.join(',')}}`;
}
