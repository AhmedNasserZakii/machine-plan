import { MACHINE_STATUSES, MachineStatus } from 'src/common/enums/machine-status.enum';
import { WAREHOUSE_TYPES, WarehouseType } from 'src/common/enums/operations.enum';
import {
  PartyType,
  SignaturePartyRole,
  TransferDirection,
  TRANSFER_TYPES,
  TransferType,
} from 'src/common/enums/transfer.enum';
import { partyForRole } from '../transfer-parties';
import { receiverIsCreator, requiresReceiverAccount, TRANSFER_RULES } from '../transfer-rules';
import { receiverKindFor } from '../transfers.service';
import { SystemRole } from 'src/modules/roles/entities/role.entity';

describe('TRANSFER_RULES', () => {
  it('covers every declared transfer type', () => {
    expect(Object.keys(TRANSFER_RULES).sort()).toEqual([...TRANSFER_TYPES].sort());
  });

  it('only ever resolves to a real machine status', () => {
    for (const rule of Object.values(TRANSFER_RULES)) {
      expect(MACHINE_STATUSES).toContain(rule.resultStatus);

      for (const status of rule.allowedFromStatuses) {
        expect(MACHINE_STATUSES).toContain(status);
      }
    }
  });

  /**
   * The two moves the business explicitly forbids. They are absent from the map rather than
   * checked for, so this test is what stops someone adding them "just for the warehouse team".
   */
  it('has no edge between two branches or two representatives', () => {
    const rules = Object.values(TRANSFER_RULES);

    expect(
      rules.some((rule) => rule.from === PartyType.SUPERVISOR && rule.to === PartyType.SUPERVISOR),
    ).toBe(false);

    expect(
      rules.some(
        (rule) => rule.from === PartyType.REPRESENTATIVE && rule.to === PartyType.REPRESENTATIVE,
      ),
    ).toBe(false);
  });

  it('never lets a machine leave a terminal status', () => {
    for (const rule of Object.values(TRANSFER_RULES)) {
      expect(rule.allowedFromStatuses).not.toContain(MachineStatus.DECOMMISSIONED);
      expect(rule.allowedFromStatuses).not.toContain(MachineStatus.REPLACED);
    }
  });

  it('never accepts a machine that is already in transit', () => {
    for (const rule of Object.values(TRANSFER_RULES)) {
      expect(rule.allowedFromStatuses).not.toContain(MachineStatus.IN_TRANSIT);
    }
  });

  it('requires a same-branch pairing only between a supervisor and his representative', () => {
    const sameBranch = Object.entries(TRANSFER_RULES)
      .filter(([, rule]) => rule.sameBranchRequired)
      .map(([type]) => type);

    expect(sameBranch.sort()).toEqual(
      [TransferType.BRANCH_TO_REPRESENTATIVE, TransferType.REPRESENTATIVE_TO_BRANCH].sort(),
    );
  });

  /** Nobody is on the other end to sign, so the sender attests and the document closes at once. */
  it('auto-confirms exactly the legs with no counterparty account', () => {
    const autoConfirm = Object.entries(TRANSFER_RULES)
      .filter(([, rule]) => rule.autoConfirm)
      .map(([type]) => type);

    expect(autoConfirm.sort()).toEqual(
      [
        TransferType.REPRESENTATIVE_TO_MERCHANT,
        TransferType.MERCHANT_TO_REPRESENTATIVE,
        TransferType.COMPANY_TO_FACTORY,
        TransferType.COMPANY_TO_SERVICE_CENTER,
        TransferType.COMPANY_TO_SCRAP,
      ].sort(),
    );

    for (const type of autoConfirm) {
      expect(requiresReceiverAccount(type as TransferType)).toBe(false);
    }
  });

  it('collects a sender signature on every auto-confirmed leg', () => {
    for (const rule of Object.values(TRANSFER_RULES)) {
      if (!rule.autoConfirm) continue;

      // MERCHANT_TO_REPRESENTATIVE is the exception: the representative is present and signs as
      // the receiver even though the merchant has no account.
      expect(rule.signatures.length).toBeGreaterThan(0);
    }
  });

  it('runs violation checks on the return legs, where mismatches surface', () => {
    const checked = Object.entries(TRANSFER_RULES)
      .filter(([, rule]) => rule.runViolationChecks)
      .map(([type]) => type);

    for (const type of checked) {
      expect(TRANSFER_RULES[type as TransferType].direction).toBe(TransferDirection.RETURN);
    }

    expect(checked).toContain(TransferType.REPRESENTATIVE_TO_BRANCH);
  });

  it('always names at least one signing party', () => {
    for (const rule of Object.values(TRANSFER_RULES)) {
      expect(rule.signatures.length).toBeGreaterThan(0);

      for (const role of rule.signatures) {
        expect([SignaturePartyRole.SENDER, SignaturePartyRole.RECEIVER]).toContain(role);
      }
    }
  });

  /**
   * "To a warehouse" is not specific enough to be safe. Left open, a company return could be
   * routed into another branch's store — which is the branch-to-branch move this map exists
   * to make unrepresentable — and a scrapping could land in a maintenance store, leaving the
   * machine's status and its physical location disagreeing.
   */
  describe('warehouse destinations', () => {
    it('constrains the receiving warehouse type on every warehouse-bound leg', () => {
      for (const [type, rule] of Object.entries(TRANSFER_RULES)) {
        if (rule.to !== PartyType.WAREHOUSE) continue;

        expect(rule.toWarehouseTypes?.length).toBeGreaterThan(0);
        expect(type).toBeTruthy();
      }
    });

    it('only ever names real warehouse types', () => {
      for (const rule of Object.values(TRANSFER_RULES)) {
        for (const warehouseType of rule.toWarehouseTypes ?? []) {
          expect(WAREHOUSE_TYPES).toContain(warehouseType);
        }
      }
    });

    it('sends each leg to the store its result status implies', () => {
      expect(TRANSFER_RULES[TransferType.COMPANY_TO_SCRAP].toWarehouseTypes).toEqual([
        WarehouseType.SCRAP,
      ]);
      expect(TRANSFER_RULES[TransferType.COMPANY_TO_MAINTENANCE].toWarehouseTypes).toEqual([
        WarehouseType.MAINTENANCE,
      ]);
      expect(TRANSFER_RULES[TransferType.BRANCH_TO_COMPANY].toWarehouseTypes).toEqual([
        WarehouseType.COMPANY_MAIN,
      ]);
    });

    /** A branch store is never a destination: that route is what BRANCH_TO_COMPANY is for. */
    it('never routes a transfer into a branch warehouse', () => {
      for (const rule of Object.values(TRANSFER_RULES)) {
        expect(rule.toWarehouseTypes ?? []).not.toContain(WarehouseType.BRANCH);
      }
    });
  });

  describe('receiverIsCreator', () => {
    /**
     * The merchant-return leg only. A shop has no account, so the representative who takes
     * the machines back is the receiving party — there is nobody for him to name.
     */
    it('holds for the merchant return and for nothing else', () => {
      const matching = TRANSFER_TYPES.filter((type) => receiverIsCreator(TRANSFER_RULES[type]));

      expect(matching).toEqual([TransferType.MERCHANT_TO_REPRESENTATIVE]);
    });

    /**
     * The client builds its receiver picker from `receiverKind`, so a leg whose receiver is
     * the caller must never be advertised as one needing a choice. Offering a picker here
     * would list only other people — the caller is excluded from his own recipient list —
     * and every one of them is someone the server refuses to hand custody to.
     */
    it('is never advertised to the client as a leg needing a chosen receiver', () => {
      for (const type of TRANSFER_TYPES) {
        const rule = TRANSFER_RULES[type];
        if (!receiverIsCreator(rule)) continue;

        expect(receiverKindFor(rule)).toBe('NONE');
      }
    });
  });
});

describe('partyForRole', () => {
  it('maps a director onto the company warehouse, not onto a party of his own', () => {
    expect(partyForRole(SystemRole.DIRECTOR)).toBe(PartyType.WAREHOUSE);
  });

  it('maps field roles onto the party they physically are', () => {
    expect(partyForRole(SystemRole.BRANCH_SUPERVISOR)).toBe(PartyType.SUPERVISOR);
    expect(partyForRole(SystemRole.REPRESENTATIVE)).toBe(PartyType.REPRESENTATIVE);
  });

  it('gives back-office roles no custody party at all', () => {
    expect(partyForRole(SystemRole.ACCOUNTANT)).toBeNull();
    expect(partyForRole(SystemRole.VIEWER)).toBeNull();
  });
});
