import { TransactionSource } from 'src/common/enums/finance.enum';
import {
  backdateDays,
  isAutoPosted,
  isFutureDate,
  isWithinEditWindow,
  toDateOnly,
} from '../transaction-rules';

const TODAY = '2026-09-08';

describe('toDateOnly', () => {
  it('keeps the calendar day and drops the moment', () => {
    expect(toDateOnly(new Date('2026-09-08T23:45:00.000Z'))).toBe(TODAY);
  });
});

describe('backdateDays', () => {
  it('is zero for today, whatever hour the entry was made at', () => {
    expect(backdateDays(TODAY, TODAY)).toBe(0);
  });

  it('counts calendar days back', () => {
    expect(backdateDays('2026-06-10', TODAY)).toBe(90);
  });

  it('goes negative into the future', () => {
    expect(backdateDays('2026-09-09', TODAY)).toBe(-1);
  });

  it('is unaffected by the daylight-saving shift a local clock would introduce', () => {
    expect(backdateDays('2026-03-01', '2026-04-01')).toBe(31);
  });
});

describe('isFutureDate', () => {
  it('accepts today', () => {
    expect(isFutureDate(TODAY, TODAY)).toBe(false);
  });

  it('rejects tomorrow', () => {
    expect(isFutureDate('2026-09-09', TODAY)).toBe(true);
  });
});

describe('isWithinEditWindow', () => {
  const now = new Date('2026-09-08T12:00:00.000Z');

  it('allows a correction on the day of entry', () => {
    expect(isWithinEditWindow(new Date('2026-09-08T09:00:00.000Z'), 30, now)).toBe(true);
  });

  it('allows a correction on the last day of the window', () => {
    expect(isWithinEditWindow(new Date('2026-08-09T12:00:00.000Z'), 30, now)).toBe(true);
  });

  it('refuses one past the window', () => {
    expect(isWithinEditWindow(new Date('2026-08-01T12:00:00.000Z'), 30, now)).toBe(false);
  });

  it('measures from when it was entered, not from the date it carries', () => {
    // A legitimately backdated entry gets the same window as any other, so a March invoice
    // booked today is still correctable today.
    expect(isWithinEditWindow(new Date('2026-09-08T00:00:00.000Z'), 30, now)).toBe(true);
  });
});

describe('isAutoPosted', () => {
  it('is false only for a manual row', () => {
    expect(isAutoPosted(TransactionSource.MANUAL)).toBe(false);
  });

  it('is true for every origin-owned row', () => {
    expect(isAutoPosted(TransactionSource.AUTO_MAINTENANCE)).toBe(true);
    expect(isAutoPosted(TransactionSource.AUTO_VIOLATION)).toBe(true);
    expect(isAutoPosted(TransactionSource.AUTO_SUBSCRIPTION)).toBe(true);
  });
});
