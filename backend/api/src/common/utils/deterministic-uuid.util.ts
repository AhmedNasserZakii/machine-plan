import { createHash } from 'node:crypto';

/**
 * An RFC 4122 version 5 UUID: the SHA-1 of a namespace and a name, rendered as a UUID.
 *
 * Used where a UUID column has to be derived from facts rather than invented — a repeatable
 * subscription collection needs an identity that survives a retry, and a random id would defeat
 * the very unique index that makes the posting idempotent.
 */
export function deterministicUuid(namespace: string, name: string): string {
  const digest = createHash('sha1')
    .update(Buffer.concat([uuidToBytes(namespace), Buffer.from(name, 'utf8')]))
    .digest();

  const bytes = digest.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}
