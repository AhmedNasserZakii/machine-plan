import { NotificationTemplateCode } from 'src/common/enums/notification.enum';
import {
  dayBucket,
  daysSince,
  daysUntil,
  dedupeKey,
  hoursSince,
  isWithinQuietHours,
  localHourOf,
  nextSendableAt,
  placeholdersIn,
  QuietHours,
  renderTemplate,
  shouldDigest,
  weekBucket,
} from '../notification-rules';

/** Egypt: 21:00–08:00 local, two hours east of UTC. */
const CAIRO: QuietHours = { start: 21, end: 8, offsetMinutes: 120 };

describe('renderTemplate', () => {
  it('fills every placeholder from the params', () => {
    expect(
      renderTemplate('الماكينة {machineSerial} في {locationName}', {
        machineSerial: 'SN-1',
        locationName: 'الورشة',
      }),
    ).toBe('الماكينة SN-1 في الورشة');
  });

  it('substitutes a repeated placeholder everywhere it appears', () => {
    expect(renderTemplate('{a} then {a}', { a: 'x' })).toBe('x then x');
  });

  it('stringifies numbers, so a count renders as a count', () => {
    expect(renderTemplate('{count} items', { count: 3 })).toBe('3 items');
  });

  it('renders a zero rather than treating it as absent', () => {
    expect(renderTemplate('{count} items', { count: 0 })).toBe('0 items');
  });

  it('throws rather than shipping a literal token to somebody’s phone', () => {
    expect(() => renderTemplate('{spent} of {amount}', { spent: 10 })).toThrow(/amount/);
  });

  it('ignores params nothing asked for', () => {
    expect(renderTemplate('hello', { unused: 'x' })).toBe('hello');
  });
});

describe('placeholdersIn', () => {
  it('lists each token once, in order', () => {
    expect(placeholdersIn('{b} {a} {b}')).toEqual(['b', 'a']);
  });

  it('finds none in text that has none', () => {
    expect(placeholdersIn('no tokens here')).toEqual([]);
  });
});

describe('isWithinQuietHours', () => {
  it('is quiet at 22:00 local, inside the wrapping window', () => {
    expect(isWithinQuietHours(new Date('2026-09-08T20:00:00.000Z'), CAIRO)).toBe(true);
  });

  it('is quiet at 03:00 local, on the far side of midnight', () => {
    expect(isWithinQuietHours(new Date('2026-09-09T01:00:00.000Z'), CAIRO)).toBe(true);
  });

  it('is not quiet at 08:00 local, the hour it resumes', () => {
    expect(isWithinQuietHours(new Date('2026-09-09T06:00:00.000Z'), CAIRO)).toBe(false);
  });

  it('is not quiet at midday', () => {
    expect(isWithinQuietHours(new Date('2026-09-08T10:00:00.000Z'), CAIRO)).toBe(false);
  });

  it('handles a window that does not wrap midnight', () => {
    const siesta: QuietHours = { start: 13, end: 15, offsetMinutes: 120 };

    expect(isWithinQuietHours(new Date('2026-09-08T12:00:00.000Z'), siesta)).toBe(true);
    expect(isWithinQuietHours(new Date('2026-09-08T14:00:00.000Z'), siesta)).toBe(false);
  });

  it('treats an empty window as no quiet hours at all', () => {
    const none: QuietHours = { start: 8, end: 8, offsetMinutes: 120 };

    expect(isWithinQuietHours(new Date('2026-09-08T06:00:00.000Z'), none)).toBe(false);
  });
});

describe('nextSendableAt', () => {
  it('sends a late-evening deferral out the next morning', () => {
    // 21:05 Cairo on the 8th → 08:00 Cairo on the 9th, which is 06:00 UTC.
    expect(nextSendableAt(new Date('2026-09-08T19:05:00.000Z'), CAIRO).toISOString()).toBe(
      '2026-09-09T06:00:00.000Z',
    );
  });

  it('sends an after-midnight deferral out the same morning', () => {
    expect(nextSendableAt(new Date('2026-09-09T01:00:00.000Z'), CAIRO).toISOString()).toBe(
      '2026-09-09T06:00:00.000Z',
    );
  });

  it('lands both deferrals of one night on the same instant', () => {
    const evening = nextSendableAt(new Date('2026-09-08T19:05:00.000Z'), CAIRO);
    const smallHours = nextSendableAt(new Date('2026-09-09T01:00:00.000Z'), CAIRO);

    expect(evening.getTime()).toBe(smallHours.getTime());
  });
});

describe('localHourOf', () => {
  it('reads the recipient’s wall clock, not the server’s', () => {
    expect(localHourOf(new Date('2026-09-08T22:30:00.000Z'), 120)).toBe(0);
  });
});

describe('dedupeKey', () => {
  it('separates the two reminder waves of one transfer', () => {
    const first = dedupeKey(NotificationTemplateCode.TRANSFER_REMINDER, 'tr-1', '24h');
    const second = dedupeKey(NotificationTemplateCode.TRANSFER_REMINDER, 'tr-1', '48h');

    expect(first).not.toBe(second);
  });

  it('collapses a re-run of the same window onto one key', () => {
    expect(dedupeKey(NotificationTemplateCode.MACHINE_IDLE, 'm-1', '2026-W37')).toBe(
      dedupeKey(NotificationTemplateCode.MACHINE_IDLE, 'm-1', '2026-W37'),
    );
  });
});

describe('buckets', () => {
  it('gives a day bucket per calendar day', () => {
    expect(dayBucket(new Date('2026-09-08T23:59:00.000Z'))).toBe('2026-09-08');
    expect(dayBucket(new Date('2026-09-09T00:01:00.000Z'))).toBe('2026-09-09');
  });

  it('gives one ISO week bucket across a Monday-to-Sunday span', () => {
    const monday = weekBucket(new Date('2026-09-07T00:00:00.000Z'));
    const sunday = weekBucket(new Date('2026-09-13T23:00:00.000Z'));

    expect(monday).toBe(sunday);
    expect(monday).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('does not collide across a year boundary', () => {
    expect(weekBucket(new Date('2026-12-31T00:00:00.000Z'))).not.toBe(
      weekBucket(new Date('2025-12-31T00:00:00.000Z')),
    );
  });
});

describe('elapsed helpers', () => {
  it('floors hours since a hand-off', () => {
    expect(
      hoursSince(new Date('2026-09-07T12:00:00.000Z'), new Date('2026-09-08T11:59:00.000Z')),
    ).toBe(23);
  });

  it('floors days since a movement', () => {
    expect(
      daysSince(new Date('2026-06-01T00:00:00.000Z'), new Date('2026-09-08T12:00:00.000Z')),
    ).toBe(99);
  });

  it('counts days until a warranty ends, and goes negative once it has passed', () => {
    expect(daysUntil('2026-10-08', '2026-09-08')).toBe(30);
    expect(daysUntil('2026-09-08', '2026-09-08')).toBe(0);
    expect(daysUntil('2026-09-01', '2026-09-08')).toBe(-7);
  });
});

describe('shouldDigest', () => {
  it('folds the message that would cross the threshold', () => {
    expect(shouldDigest(5, 5)).toBe(true);
  });

  it('leaves anything under the threshold alone', () => {
    expect(shouldDigest(4, 5)).toBe(false);
  });
});
