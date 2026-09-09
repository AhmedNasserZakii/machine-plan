import {
  BudgetStatus,
  budgetStatusOf,
  DEFAULT_ALERT_THRESHOLD_PERCENT,
  escalationOf,
  isBudgetStatus,
  paceOf,
  periodProgressOf,
  periodsOverlap,
  usedPercentOf,
} from '../budget-rules';

describe('usedPercentOf', () => {
  it('reports the share of the limit that has been spent', () => {
    expect(usedPercentOf(27400, 30000)).toBeCloseTo(91.33, 2);
  });

  it('reports zero rather than dividing by a limit of zero', () => {
    expect(usedPercentOf(500, 0)).toBe(0);
  });
});

describe('budgetStatusOf', () => {
  const threshold = DEFAULT_ALERT_THRESHOLD_PERCENT;

  it('is OK below the alert threshold', () => {
    expect(budgetStatusOf(79.9, threshold)).toBe(BudgetStatus.OK);
  });

  it('warns from the threshold up to the limit', () => {
    expect(budgetStatusOf(threshold, threshold)).toBe(BudgetStatus.WARNING);
    expect(budgetStatusOf(99.9, threshold)).toBe(BudgetStatus.WARNING);
  });

  it('is exceeded at exactly the limit', () => {
    expect(budgetStatusOf(100, threshold)).toBe(BudgetStatus.EXCEEDED);
  });

  it('judges on the unrounded figure, so 99.96% is not yet exceeded', () => {
    expect(budgetStatusOf(99.96, threshold)).toBe(BudgetStatus.WARNING);
  });

  it('honours a threshold the operator moved', () => {
    expect(budgetStatusOf(55, 50)).toBe(BudgetStatus.WARNING);
    expect(budgetStatusOf(55, 60)).toBe(BudgetStatus.OK);
  });
});

describe('escalationOf', () => {
  it('announces the first warning', () => {
    expect(escalationOf(null, BudgetStatus.WARNING)).toBe(BudgetStatus.WARNING);
  });

  it('says nothing on a second transaction still inside the same level', () => {
    expect(escalationOf(BudgetStatus.WARNING, BudgetStatus.WARNING)).toBeNull();
  });

  it('announces the move from warning to exceeded', () => {
    expect(escalationOf(BudgetStatus.WARNING, BudgetStatus.EXCEEDED)).toBe(BudgetStatus.EXCEEDED);
  });

  it('stays silent when a void drops the budget back below a threshold', () => {
    expect(escalationOf(BudgetStatus.EXCEEDED, BudgetStatus.WARNING)).toBeNull();
    expect(escalationOf(BudgetStatus.WARNING, BudgetStatus.OK)).toBeNull();
  });

  it('treats a level it does not recognise as never having been announced', () => {
    expect(escalationOf('WHATEVER', BudgetStatus.WARNING)).toBe(BudgetStatus.WARNING);
  });
});

describe('isBudgetStatus', () => {
  it('accepts the three levels and nothing else', () => {
    expect(isBudgetStatus('EXCEEDED')).toBe(true);
    expect(isBudgetStatus('CRITICAL')).toBe(false);
    expect(isBudgetStatus(null)).toBe(false);
  });
});

describe('periodProgressOf', () => {
  it('counts the current day as elapsed', () => {
    const progress = periodProgressOf('2026-09-01', '2026-09-30', '2026-09-07');

    expect(progress.daysTotal).toBe(30);
    expect(progress.daysElapsed).toBe(7);
    expect(progress.elapsedPercent).toBe(23.3);
  });

  it('reads a period that has not started yet as one day in', () => {
    expect(periodProgressOf('2026-10-01', '2026-10-31', '2026-09-07').daysElapsed).toBe(1);
  });

  it('clamps a finished period at complete', () => {
    const progress = periodProgressOf('2026-08-01', '2026-08-31', '2026-09-07');

    expect(progress.daysElapsed).toBe(31);
    expect(progress.elapsedPercent).toBe(100);
  });
});

describe('paceOf', () => {
  it('projects the period total from the run rate so far', () => {
    const progress = periodProgressOf('2026-09-01', '2026-09-30', '2026-09-07');
    const pace = paceOf(30000, 27400, progress);

    expect(pace.expectedSpendByNow).toBe(7000);
    expect(pace.overPaceBy).toBe(20400);
    expect(pace.projectedTotal).toBe(117428.57);
  });

  it('reports a negative overage when spend is under pace', () => {
    const progress = periodProgressOf('2026-09-01', '2026-09-30', '2026-09-15');

    expect(paceOf(30000, 1000, progress).overPaceBy).toBeLessThan(0);
  });
});

describe('periodsOverlap', () => {
  it('finds an overlap when one window starts inside the other', () => {
    expect(periodsOverlap('2026-09-01', '2026-09-30', '2026-09-15', '2026-10-15')).toBe(true);
  });

  it('finds an overlap when one window contains the other', () => {
    expect(periodsOverlap('2026-01-01', '2026-12-31', '2026-09-01', '2026-09-30')).toBe(true);
  });

  it('treats both ends as inclusive, so touching windows overlap', () => {
    expect(periodsOverlap('2026-09-01', '2026-09-30', '2026-09-30', '2026-10-31')).toBe(true);
  });

  it('finds no overlap between consecutive months', () => {
    expect(periodsOverlap('2026-09-01', '2026-09-30', '2026-10-01', '2026-10-31')).toBe(false);
  });
});
