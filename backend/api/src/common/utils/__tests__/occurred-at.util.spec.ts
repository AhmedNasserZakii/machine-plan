import { ErrorCode } from 'src/common/constants/error-codes';
import { AppException } from 'src/common/errors';
import { assertOccurredAtAllowed } from '../occurred-at.util';

const NOW = new Date('2026-09-08T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function assert(occurredAt: Date, mayBackdate = false): void {
  assertOccurredAtAllowed(occurredAt, { now: NOW, mayBackdate });
}

function shift(ms: number): Date {
  return new Date(NOW.getTime() + ms);
}

function rejection(occurredAt: Date, mayBackdate = false): AppException {
  try {
    assert(occurredAt, mayBackdate);
  } catch (error) {
    return error as AppException;
  }
  throw new Error('expected the timestamp to be rejected');
}

describe('assertOccurredAtAllowed', () => {
  it('accepts the moment it is called', () => {
    expect(() => assert(NOW)).not.toThrow();
  });

  it('accepts a device clock running up to a day fast', () => {
    expect(() => assert(shift(23 * HOUR))).not.toThrow();
  });

  it('rejects a hand-off dated further ahead than the tolerated skew', () => {
    expect(() => assert(shift(3 * DAY))).toThrow(AppException);
  });

  it('rejects the future even for a caller allowed to backdate', () => {
    expect(() => assert(shift(3 * DAY), true)).toThrow(AppException);
  });

  it('accepts a sync that arrives weeks after the hand-off', () => {
    expect(() => assert(shift(-29 * DAY))).not.toThrow();
  });

  it('rejects a backdate past the floor', () => {
    expect(() => assert(shift(-31 * DAY))).toThrow(AppException);
  });

  it('lets an elevated caller record an old hand-off', () => {
    expect(() => assert(shift(-200 * DAY), true)).not.toThrow();
  });

  it('rejects an unparseable date', () => {
    expect(() => assert(new Date('not a date'))).toThrow(AppException);
  });

  it('reports 422 INVALID_OCCURRED_AT naming the field', () => {
    const error = rejection(shift(3 * DAY));

    expect(error.getStatus()).toBe(422);
    expect(error.code).toBe(ErrorCode.INVALID_OCCURRED_AT);
    expect(error.details).toEqual([
      { field: 'occurredAt', constraint: 'must not be more than 24 hours in the future' },
    ]);
  });

  it('names the field the caller passed', () => {
    try {
      assertOccurredAtAllowed(shift(-90 * DAY), { now: NOW, field: 'sentAt' });
      throw new Error('expected the timestamp to be rejected');
    } catch (error) {
      expect((error as AppException).details?.[0].field).toBe('sentAt');
    }
  });
});
