import { ErrorCode } from '../../constants/error-codes';
import { AppException } from '../../errors';
import { decodeCursor, encodeCursor } from '../cursor.util';

/** Frozen so a cursor a device minted before the extract still seeks after it. */
const GOLDEN_AT = new Date('2026-03-01T08:15:30.000Z');
const GOLDEN_ID = '3f1a0c2e-7b4d-4a91-9e2c-0d8b6f5a1c33';
const GOLDEN_CURSOR =
  'MjAyNi0wMy0wMVQwODoxNTozMC4wMDBafDNmMWEwYzJlLTdiNGQtNGE5MS05ZTJjLTBkOGI2ZjVhMWMzMw';

describe('encodeCursor / decodeCursor', () => {
  it('matches the pre-extract encoding byte-for-byte', () => {
    expect(encodeCursor(GOLDEN_AT, GOLDEN_ID)).toBe(GOLDEN_CURSOR);
  });

  it('round-trips a timestamp and id', () => {
    const encoded = encodeCursor(GOLDEN_AT, GOLDEN_ID);

    expect(decodeCursor(encoded)).toEqual({
      occurredAt: GOLDEN_AT.toISOString(),
      id: GOLDEN_ID,
    });
  });

  it('treats a missing cursor as the start of the feed', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it('rejects a malformed cursor with 400 rather than 500', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow(AppException);

    try {
      decodeCursor('not-a-cursor');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      const exception = error as AppException;
      expect(exception.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(exception.getStatus()).toBe(400);
    }
  });

  it('rejects a cursor whose fields are in the wrong order for the sort', () => {
    // The feed is ordered by (occurred_at, id). Encoding (id, occurred_at) must not seek.
    const swapped = Buffer.from(`${GOLDEN_ID}|${GOLDEN_AT.toISOString()}`).toString('base64url');

    expect(() => decodeCursor(swapped)).toThrow(AppException);
  });
});
