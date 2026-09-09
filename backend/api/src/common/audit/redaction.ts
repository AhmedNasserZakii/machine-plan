/**
 * Field names that must never reach `audit_logs`, wherever they appear in a `before`/`after`
 * snapshot — a top-level column or three levels deep inside a nested object (`21`: "never store
 * `password_hash`, tokens, or full national IDs").
 *
 * Matched case-insensitively with underscores stripped, so `passwordHash`, `password_hash` and
 * `PASSWORD_HASH` are all one entry here. Add to this list rather than hand-redacting at a call
 * site — a forgotten call site is a leak, a missing list entry is caught by the tests below.
 */
export const REDACTED_FIELDS: ReadonlySet<string> = new Set(
  [
    'password',
    'newPassword',
    'currentPassword',
    'temporaryPassword',
    'passwordHash',
    'token',
    'tokenHash',
    'accessToken',
    'refreshToken',
    'secret',
    'clientSecret',
    'nationalId',
  ].map(normalizeKey),
);

export const REDACTED_PLACEHOLDER = '[REDACTED]';

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/_/g, '');
}

/**
 * Deep-redacts `REDACTED_FIELDS` in place on a clone of `value`, recursing into plain objects and
 * arrays. Primitives and non-plain objects (e.g. `Date`) pass through unchanged.
 */
export function redact<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      result[key] = REDACTED_FIELDS.has(normalizeKey(key))
        ? REDACTED_PLACEHOLDER
        : redactValue(entryValue);
    }
    return result;
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
  );
}
