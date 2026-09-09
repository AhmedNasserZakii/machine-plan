import { Severity } from 'src/common/enums/operations.enum';
import { representativeScore, SCORE_FORMULA, tallyBySeverity } from '../report-scoring';

describe('representativeScore', () => {
  it('gives a clean record full marks', () => {
    expect(representativeScore({ high: 0, medium: 0, low: 0, lateConfirmations: 0 })).toBe(100);
  });

  it('weighs a high violation more heavily than a low one', () => {
    const high = representativeScore({ high: 1, medium: 0, low: 0, lateConfirmations: 0 });
    const low = representativeScore({ high: 0, medium: 0, low: 1, lateConfirmations: 0 });

    expect(high).toBeLessThan(low);
    expect(high).toBe(90);
    expect(low).toBe(98);
  });

  it('adds the penalties up', () => {
    expect(representativeScore({ high: 2, medium: 1, low: 1, lateConfirmations: 3 })).toBe(
      100 - 20 - 5 - 2 - 3,
    );
  });

  it('floors at zero rather than going negative', () => {
    expect(representativeScore({ high: 20, medium: 0, low: 0, lateConfirmations: 0 })).toBe(0);
  });

  it('publishes a formula that matches the arithmetic', () => {
    expect(SCORE_FORMULA).toContain('× 10');
    expect(SCORE_FORMULA).toContain('× 5');
    expect(SCORE_FORMULA).toContain('× 2');
  });
});

describe('tallyBySeverity', () => {
  it('groups the per-severity counts the query returns', () => {
    expect(
      tallyBySeverity(
        [
          { severity: Severity.HIGH, count: 2 },
          { severity: Severity.LOW, count: 4 },
        ],
        1,
      ),
    ).toEqual({ high: 2, medium: 0, low: 4, lateConfirmations: 1 });
  });

  it('reads an absent severity as none of them', () => {
    expect(tallyBySeverity([], 0)).toEqual({
      high: 0,
      medium: 0,
      low: 0,
      lateConfirmations: 0,
    });
  });
});
