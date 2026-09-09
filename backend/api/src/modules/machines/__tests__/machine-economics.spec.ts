import { DecommissionThresholds } from 'src/modules/settings/settings.catalogue';
import { costToValueRatio, Recommendation, recommendFor } from '../machine-economics';

/** The seeded defaults from `13`. */
const THRESHOLDS: DecommissionThresholds = {
  reviewRatio: 0.4,
  considerRatio: 0.7,
  considerRepairCount: 5,
};

describe('recommendFor', () => {
  it('keeps a machine whose repairs have cost almost nothing', () => {
    expect(recommendFor({ costToValueRatio: 0.1, repairCount: 1 }, THRESHOLDS)).toBe(
      Recommendation.KEEP,
    );
  });

  it('flags for review between the two ratios', () => {
    expect(recommendFor({ costToValueRatio: 0.4, repairCount: 2 }, THRESHOLDS)).toBe(
      Recommendation.REVIEW,
    );
    expect(recommendFor({ costToValueRatio: 0.69, repairCount: 2 }, THRESHOLDS)).toBe(
      Recommendation.REVIEW,
    );
  });

  /** Inclusive at the consider ratio, so the verdict matches the candidates query. */
  it('recommends decommissioning at and above the consider ratio', () => {
    expect(recommendFor({ costToValueRatio: 0.7, repairCount: 1 }, THRESHOLDS)).toBe(
      Recommendation.CONSIDER_DECOMMISSION,
    );
    expect(recommendFor({ costToValueRatio: 0.81, repairCount: 1 }, THRESHOLDS)).toBe(
      Recommendation.CONSIDER_DECOMMISSION,
    );
  });

  /** A cheap unit repaired six times is unreliable whatever the money says. */
  it('recommends decommissioning on repair count alone', () => {
    expect(recommendFor({ costToValueRatio: 0.05, repairCount: 6 }, THRESHOLDS)).toBe(
      Recommendation.CONSIDER_DECOMMISSION,
    );
  });

  it('judges a machine with no purchase price on the repair count only', () => {
    expect(recommendFor({ costToValueRatio: null, repairCount: 2 }, THRESHOLDS)).toBe(
      Recommendation.KEEP,
    );
    expect(recommendFor({ costToValueRatio: null, repairCount: 5 }, THRESHOLDS)).toBe(
      Recommendation.CONSIDER_DECOMMISSION,
    );
  });

  it('follows the thresholds it is given rather than the defaults', () => {
    const strict: DecommissionThresholds = {
      reviewRatio: 0.1,
      considerRatio: 0.2,
      considerRepairCount: 50,
    };

    expect(recommendFor({ costToValueRatio: 0.25, repairCount: 1 }, strict)).toBe(
      Recommendation.CONSIDER_DECOMMISSION,
    );
  });
});

describe('costToValueRatio', () => {
  it('rounds to two decimals', () => {
    expect(costToValueRatio(2250, 4200)).toBe(0.54);
  });

  /** A ratio against nothing says nothing, so it is withheld rather than guessed at. */
  it('returns null without a purchase price', () => {
    expect(costToValueRatio(500, null)).toBeNull();
    expect(costToValueRatio(500, 0)).toBeNull();
  });
});
