import { Severity } from 'src/common/enums/operations.enum';
import { ItemCondition } from 'src/common/enums/transfer.enum';
import { TransferItem } from 'src/modules/transfers/entities/transfer-item.entity';

/** The seeded `violation_types.code` values the detector may raise. */
export const ViolationCode = {
  BATTERY_MISMATCH: 'BATTERY_MISMATCH',
  MISSING_CHARGER: 'MISSING_CHARGER',
  MISSING_BOX: 'MISSING_BOX',
  PHYSICAL_DAMAGE: 'PHYSICAL_DAMAGE',
  LATE_RETURN: 'LATE_RETURN',
  MISSING_MACHINE: 'MISSING_MACHINE',
  OTHER: 'OTHER',
} as const;

export type ViolationCodeValue = (typeof ViolationCode)[keyof typeof ViolationCode];

export interface DetectedViolation {
  code: ViolationCodeValue;
  severity: Severity;
  /** Written into `description`; the numbers a supervisor needs to judge it without digging. */
  description: string;
}

/**
 * What the representative was handed, read off the last confirmed outbound item for this machine.
 *
 * Deliberately not the machine row: that reflects the present. If a machine went out with a
 * charger, came back without one, and was then re-issued, comparing against the machine would
 * silently forgive the first loss. The baseline has to be what *he* signed for.
 */
export interface OutboundBaseline {
  hasCharger: boolean;
  hasBox: boolean;
  condition: ItemCondition;
  /** When the machine left, which is what `LATE_RETURN` is measured from. */
  issuedAt: Date;
}

/** Physical states that mean the unit came back worse than it went out. */
const DAMAGED_CONDITIONS: readonly ItemCondition[] = [
  ItemCondition.DAMAGED,
  ItemCondition.NOT_WORKING,
];

export interface DetectionInput {
  item: TransferItem;
  /** Null when the machine has no confirmed outbound leg — nothing to compare against. */
  baseline: OutboundBaseline | null;
  /** From `business.idleAlertDays`. */
  idleAlertDays: number;
  expectedBatterySerial: string | null;
  now: Date;
  /**
   * False when the elapsed time is not the responsible user's to answer for — a machine
   * sitting in a merchant's shop for three months is a placement, not a late return by the
   * representative who put it there.
   */
  checkLateReturn?: boolean;
}

/**
 * The return-leg checks from `10`.
 *
 * Every rule is a comparison against what the man was handed, and every one of them *accepts* the
 * hand-off — a mismatch is recorded, never used to reject. That distinction is the whole design:
 * refusing the machine leaves it in a representative's car with no record, which is strictly worse
 * than taking it back and writing down what was wrong.
 */
export function detectViolations(input: DetectionInput): DetectedViolation[] {
  const { item, baseline, expectedBatterySerial } = input;
  const found: DetectedViolation[] = [];

  // `false` and `null` are different facts: nobody scanned the battery is not the same as the
  // battery is the wrong one, and only the second is an accusation.
  if (item.batteryMatches === false) {
    found.push({
      code: ViolationCode.BATTERY_MISMATCH,
      severity: Severity.HIGH,
      description:
        `Battery returned as ${item.batterySerialScanned ?? 'unknown'}, ` +
        `bonded battery is ${expectedBatterySerial ?? 'unknown'}`,
    });
  }

  if (baseline === null) return found;

  if (baseline.hasCharger && !item.hasCharger) {
    found.push({
      code: ViolationCode.MISSING_CHARGER,
      severity: Severity.MEDIUM,
      description: 'Issued with a charger and returned without one',
    });
  }

  if (baseline.hasBox && !item.hasBox) {
    found.push({
      code: ViolationCode.MISSING_BOX,
      severity: Severity.LOW,
      description: 'Issued boxed and returned without the carton',
    });
  }

  // Only a unit that went out sound and came back broken is a violation. One that was already
  // damaged when it was issued is the company's problem, not his.
  if (
    DAMAGED_CONDITIONS.includes(item.condition) &&
    !DAMAGED_CONDITIONS.includes(baseline.condition)
  ) {
    found.push({
      code: ViolationCode.PHYSICAL_DAMAGE,
      severity: Severity.HIGH,
      description: `Issued in ${baseline.condition} condition and returned ${item.condition}`,
    });
  }

  const heldDays = Math.floor(
    (input.now.getTime() - baseline.issuedAt.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (input.checkLateReturn !== false && heldDays > input.idleAlertDays) {
    found.push({
      code: ViolationCode.LATE_RETURN,
      severity: Severity.LOW,
      description: `Held for ${heldDays} days, past the ${input.idleAlertDays}-day limit`,
    });
  }

  return found;
}
