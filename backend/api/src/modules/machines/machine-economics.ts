import { DecommissionThresholds } from 'src/modules/settings/settings.catalogue';

/**
 * The advice, never the action (`13`, rule 1). The system says a machine has cost more than it is
 * worth; a human decides whether it goes to the scrap store.
 */
export const Recommendation = {
  KEEP: 'KEEP',
  REVIEW: 'REVIEW',
  CONSIDER_DECOMMISSION: 'CONSIDER_DECOMMISSION',
} as const;

export type RecommendationValue = (typeof Recommendation)[keyof typeof Recommendation];

export interface EconomicsInput {
  /** Repair spend over purchase price, or null when the machine has no recorded price. */
  costToValueRatio: number | null;
  repairCount: number;
}

/**
 * `KEEP` below the review ratio, `REVIEW` between the two, `CONSIDER_DECOMMISSION` above the
 * consider ratio **or** once the repair count alone says enough — a cheap unit repaired six times
 * is a unit nobody can rely on, whatever the money says.
 *
 * A machine with no purchase price is judged on the repair count only. Guessing a price would put
 * a fabricated ratio in front of the person taking the decision.
 */
export function recommendFor(
  input: EconomicsInput,
  thresholds: DecommissionThresholds,
): RecommendationValue {
  if (input.repairCount >= thresholds.considerRepairCount) {
    return Recommendation.CONSIDER_DECOMMISSION;
  }

  if (input.costToValueRatio === null) return Recommendation.KEEP;

  // Inclusive, so the verdict agrees with the candidates query: a machine that shows up on the
  // list because it has reached the ratio must not then read as `REVIEW` when it is opened.
  if (input.costToValueRatio >= thresholds.considerRatio) {
    return Recommendation.CONSIDER_DECOMMISSION;
  }

  return input.costToValueRatio >= thresholds.reviewRatio
    ? Recommendation.REVIEW
    : Recommendation.KEEP;
}

/** Two decimals, because this is a ratio a person reads, not a number anything is paid against. */
export function costToValueRatio(repairCost: number, purchasePrice: number | null): number | null {
  if (purchasePrice === null || purchasePrice <= 0) return null;

  return Math.round((repairCost / purchasePrice) * 100) / 100;
}
