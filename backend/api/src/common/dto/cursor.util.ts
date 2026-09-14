import { ErrorCode } from '../constants/error-codes';
import { AppException } from '../errors';

export interface KeysetCursor {
  occurredAt: string;
  id: string;
}

/**
 * Opaque keyset cursor: `base64url(ISO-8601 timestamp + '|' + id)`.
 *
 * Byte-identical to the private copies that used to live in `audit-logs.service` and
 * `machine-insights.service`, so a cursor a device is holding mid-session still seeks.
 */
export function encodeCursor(occurredAt: Date, id: string): string {
  return Buffer.from(`${occurredAt.toISOString()}|${id}`).toString('base64url');
}

/**
 * Missing/empty cursor means "start from the top". Anything that does not decode into a
 * timestamp and an id is a 400 — a garbled seek must not 500, and must not silently restart.
 */
export function decodeCursor(cursor?: string): KeysetCursor | null {
  if (!cursor) return null;

  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const separator = decoded.indexOf('|');
  const occurredAt = separator === -1 ? '' : decoded.slice(0, separator);
  const id = separator === -1 ? '' : decoded.slice(separator + 1);

  if (!occurredAt || !id || Number.isNaN(Date.parse(occurredAt))) {
    throw new AppException(ErrorCode.VALIDATION_FAILED, {
      details: [{ field: 'cursor', value: cursor, constraint: 'malformed keyset cursor' }],
    });
  }

  return { occurredAt, id };
}
