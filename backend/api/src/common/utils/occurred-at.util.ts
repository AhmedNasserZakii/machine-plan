import { ErrorCode } from '../constants/error-codes';
import { AppException } from '../errors';

/** A device clock may run ahead; a day of drift is tolerated, a hand-off next week is not. */
export const MAX_OCCURRED_AT_SKEW_MS = 24 * 60 * 60 * 1000;

/** Beyond this, recording a hand-off is a correction to history and needs an elevated caller. */
export const MAX_OCCURRED_AT_BACKDATE_MS = 30 * 24 * 60 * 60 * 1000;

export interface OccurredAtLimits {
  /** Lifts the 30-day floor. The 24h ceiling is not liftable — nobody hands over a machine later. */
  mayBackdate?: boolean;
  field?: string;
  now?: Date;
}

/**
 * Guards the device-supplied `occurredAt` against clock skew (`20`, mechanism 3).
 *
 * The window is asymmetric because the two failures are not alike: a clock running fast is a
 * misconfigured phone and its reading is worthless, while a date months back is usually a real
 * backfill somebody is entitled to make.
 */
export function assertOccurredAtAllowed(occurredAt: Date, limits: OccurredAtLimits = {}): void {
  const field = limits.field ?? 'occurredAt';
  const now = limits.now ?? new Date();

  if (Number.isNaN(occurredAt.getTime())) {
    throw invalid(field, 'must be a valid timestamp');
  }

  const drift = occurredAt.getTime() - now.getTime();

  if (drift > MAX_OCCURRED_AT_SKEW_MS) {
    throw invalid(field, 'must not be more than 24 hours in the future');
  }

  if (!limits.mayBackdate && -drift > MAX_OCCURRED_AT_BACKDATE_MS) {
    throw invalid(field, 'must not be more than 30 days in the past');
  }
}

function invalid(field: string, constraint: string): AppException {
  return new AppException(ErrorCode.INVALID_OCCURRED_AT, {
    status: 422,
    details: [{ field, constraint }],
  });
}
