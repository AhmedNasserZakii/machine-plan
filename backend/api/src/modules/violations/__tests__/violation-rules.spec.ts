import { Severity } from 'src/common/enums/operations.enum';
import { ItemCondition } from 'src/common/enums/transfer.enum';
import { TransferItem } from 'src/modules/transfers/entities/transfer-item.entity';
import {
  detectViolations,
  DetectionInput,
  OutboundBaseline,
  ViolationCode,
} from '../violation-rules';

const NOW = new Date('2026-09-08T12:00:00.000Z');

function item(overrides: Partial<TransferItem> = {}): TransferItem {
  return {
    hasCharger: true,
    hasBox: false,
    condition: ItemCondition.GOOD,
    batteryMatches: null,
    batterySerialScanned: null,
    ...overrides,
  } as TransferItem;
}

function baseline(overrides: Partial<OutboundBaseline> = {}): OutboundBaseline {
  return {
    hasCharger: true,
    hasBox: false,
    condition: ItemCondition.GOOD,
    issuedAt: new Date('2026-09-01T12:00:00.000Z'),
    ...overrides,
  };
}

function detect(overrides: Partial<DetectionInput> = {}): string[] {
  return detectViolations({
    item: item(),
    baseline: baseline(),
    idleAlertDays: 30,
    expectedBatterySerial: 'BT-1',
    now: NOW,
    ...overrides,
  }).map((finding) => finding.code);
}

describe('detectViolations', () => {
  it('finds nothing when the machine comes back exactly as it went out', () => {
    expect(detect()).toEqual([]);
  });

  describe('battery', () => {
    it('raises a mismatch when the scanned serial is not the bonded one', () => {
      const found = detectViolations({
        item: item({ batteryMatches: false, batterySerialScanned: 'BT-9' }),
        baseline: baseline(),
        idleAlertDays: 30,
        expectedBatterySerial: 'BT-1',
        now: NOW,
      });

      expect(found).toHaveLength(1);
      expect(found[0].code).toBe(ViolationCode.BATTERY_MISMATCH);
      expect(found[0].severity).toBe(Severity.HIGH);
      // Both serials go in the description: a supervisor should not have to open two screens to
      // see which battery came back.
      expect(found[0].description).toContain('BT-9');
      expect(found[0].description).toContain('BT-1');
    });

    /**
     * The distinction the whole tri-state exists for. "The rep did not scan the battery" is a
     * process gap; "the battery is the wrong one" is an accusation, and only the second belongs
     * on a disciplinary file.
     */
    it('stays silent when nobody scanned the battery at all', () => {
      expect(detect({ item: item({ batteryMatches: null }) })).toEqual([]);
    });

    it('is raised even with no outbound leg to compare against', () => {
      expect(detect({ item: item({ batteryMatches: false }), baseline: null })).toEqual([
        ViolationCode.BATTERY_MISMATCH,
      ]);
    });
  });

  describe('accessories', () => {
    it('raises a missing charger only when one went out with it', () => {
      expect(detect({ item: item({ hasCharger: false }) })).toEqual([
        ViolationCode.MISSING_CHARGER,
      ]);

      expect(
        detect({
          item: item({ hasCharger: false }),
          baseline: baseline({ hasCharger: false }),
        }),
      ).toEqual([]);
    });

    it('raises a missing box only when the unit was issued boxed', () => {
      expect(
        detect({ item: item({ hasBox: false }), baseline: baseline({ hasBox: true }) }),
      ).toEqual([ViolationCode.MISSING_BOX]);

      expect(detect({ item: item({ hasBox: false }) })).toEqual([]);
    });
  });

  describe('condition', () => {
    it.each([ItemCondition.DAMAGED, ItemCondition.NOT_WORKING])(
      'raises damage when a sound unit comes back %s',
      (condition) => {
        expect(detect({ item: item({ condition }) })).toEqual([ViolationCode.PHYSICAL_DAMAGE]);
      },
    );

    /** A unit that was already broken when he was handed it is not his to answer for. */
    it('stays silent when the unit was already damaged when issued', () => {
      expect(
        detect({
          item: item({ condition: ItemCondition.NOT_WORKING }),
          baseline: baseline({ condition: ItemCondition.DAMAGED }),
        }),
      ).toEqual([]);
    });
  });

  describe('late return', () => {
    it('raises nothing inside the window', () => {
      expect(detect({ idleAlertDays: 30 })).toEqual([]);
    });

    it('raises a late return past it, and says how long', () => {
      const found = detectViolations({
        item: item(),
        baseline: baseline({ issuedAt: new Date('2026-06-01T12:00:00.000Z') }),
        idleAlertDays: 30,
        expectedBatterySerial: 'BT-1',
        now: NOW,
      });

      expect(found.map((finding) => finding.code)).toEqual([ViolationCode.LATE_RETURN]);
      expect(found[0].description).toContain('99 days');
    });

    it('cannot be judged without an outbound leg, so is not raised', () => {
      expect(detect({ baseline: null })).toEqual([]);
    });

    /**
     * On a merchant return the baseline is the leg that placed the machine in the shop, so
     * the elapsed days measure the merchant's tenancy — not lateness by the representative
     * collecting it. Every long placement would otherwise generate a violation against him.
     */
    it('is suppressed when the elapsed time is not the actor’s to answer for', () => {
      expect(
        detect({
          baseline: baseline({ issuedAt: new Date('2026-01-01T12:00:00.000Z') }),
          checkLateReturn: false,
        }),
      ).toEqual([]);
    });

    it('still reports real damage on that same suppressed leg', () => {
      expect(
        detect({
          item: item({ condition: ItemCondition.DAMAGED }),
          baseline: baseline({ issuedAt: new Date('2026-01-01T12:00:00.000Z') }),
          checkLateReturn: false,
        }),
      ).toEqual([ViolationCode.PHYSICAL_DAMAGE]);
    });
  });

  /** Four things can be wrong with one machine, and all four belong on the file. */
  it('raises every independent finding at once', () => {
    expect(
      detect({
        item: item({
          batteryMatches: false,
          hasCharger: false,
          hasBox: false,
          condition: ItemCondition.DAMAGED,
        }),
        baseline: baseline({ hasBox: true, issuedAt: new Date('2026-01-01T12:00:00.000Z') }),
      }),
    ).toEqual([
      ViolationCode.BATTERY_MISMATCH,
      ViolationCode.MISSING_CHARGER,
      ViolationCode.MISSING_BOX,
      ViolationCode.PHYSICAL_DAMAGE,
      ViolationCode.LATE_RETURN,
    ]);
  });
});
