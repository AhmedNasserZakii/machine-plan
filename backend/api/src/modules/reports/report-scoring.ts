import { Severity } from 'src/common/enums/operations.enum';

export interface ViolationTally {
  high: number;
  medium: number;
  low: number;
  /** Hand-offs the representative left unsigned past the grace window. */
  lateConfirmations: number;
}

/** The weights, named so the formula string and the arithmetic cannot drift apart. */
const WEIGHTS = { high: 10, medium: 5, low: 2, lateConfirmation: 1 } as const;

const MAX_SCORE = 100;

/**
 * Published in the response as `scoreFormula` (`17`).
 *
 * A representative's score decides conversations about his pay, so it is a sentence he can check
 * himself rather than a number he has to accept. Publishing it is not decoration: an opaque score
 * is one nobody trusts and everybody argues with.
 */
export const SCORE_FORMULA =
  `100 − (highViolations × ${WEIGHTS.high}) − (mediumViolations × ${WEIGHTS.medium})` +
  ` − (lowViolations × ${WEIGHTS.low}) − (lateConfirmations × ${WEIGHTS.lateConfirmation}),` +
  ' floored at 0';

/** How many hours a receiver has to sign before the hand-off counts against him. */
export const LATE_CONFIRMATION_HOURS = 24;

export function representativeScore(tally: ViolationTally): number {
  const penalty =
    tally.high * WEIGHTS.high +
    tally.medium * WEIGHTS.medium +
    tally.low * WEIGHTS.low +
    tally.lateConfirmations * WEIGHTS.lateConfirmation;

  return Math.max(0, MAX_SCORE - penalty);
}

/** Groups a per-severity count list into the tally the score is computed from. */
export function tallyBySeverity(
  counts: readonly { severity: Severity; count: number }[],
  lateConfirmations: number,
): ViolationTally {
  const of = (severity: Severity): number =>
    counts.find((entry) => entry.severity === severity)?.count ?? 0;

  return {
    high: of(Severity.HIGH),
    medium: of(Severity.MEDIUM),
    low: of(Severity.LOW),
    lateConfirmations,
  };
}
