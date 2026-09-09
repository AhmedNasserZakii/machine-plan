import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { WarehouseType } from 'src/common/enums/operations.enum';
import {
  PartyType,
  SignaturePartyRole,
  TransferDirection,
  TransferType,
} from 'src/common/enums/transfer.enum';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { USER_PARTIES } from './transfer-parties';

export interface TransferRule {
  from: PartyType;
  to: PartyType;
  /** Empty means the machines have no prior custody — factory intake only. */
  allowedFromStatuses: readonly MachineStatus[];
  resultStatus: MachineStatus;
  direction: TransferDirection;
  signatures: readonly SignaturePartyRole[];
  requiredPermission: string;
  /**
   * Both parties must sit in the same branch. A supervisor cannot hand a machine to another
   * branch's representative — that route goes back through the company warehouse.
   */
  sameBranchRequired?: boolean;
  /**
   * There is no counterparty account to sign: a merchant is a record, not a user. The sender
   * self-attests and the transfer confirms in the same request.
   */
  autoConfirm?: boolean;
  /** The return leg, where a swapped battery or a missing charger finally surfaces (`10`). */
  runViolationChecks?: boolean;
  /** `toPartyId` is meaningless for these — the factory and the scrapyard are not entities. */
  toPartyOptional?: boolean;
  /**
   * Which warehouses may receive this transfer. Without it "to a warehouse" means *any*
   * warehouse, which makes branch-to-branch reachable via another branch's warehouse and
   * lets a scrapping land in a maintenance store — the status and the physical location
   * would then disagree.
   */
  toWarehouseTypes?: readonly WarehouseType[];
}

/**
 * The custody graph, as data. Every legal movement in the business is one entry here, and anything
 * absent is impossible by construction — notably branch-to-branch and rep-to-rep, which are the two
 * moves people ask for and which would leave the company warehouse blind to where its fleet is.
 *
 * Nothing outside this module may set `machines.status`. This map is why.
 */
export const TRANSFER_RULES: Record<TransferType, TransferRule> = {
  [TransferType.FACTORY_TO_COMPANY]: {
    from: PartyType.FACTORY,
    to: PartyType.WAREHOUSE,
    allowedFromStatuses: [],
    resultStatus: MachineStatus.IN_COMPANY_WAREHOUSE,
    direction: TransferDirection.OUT,
    signatures: [SignaturePartyRole.RECEIVER],
    requiredPermission: Perm.TRANSFERS_CREATE,
    toWarehouseTypes: [WarehouseType.COMPANY_MAIN],
  },
  [TransferType.COMPANY_TO_BRANCH]: {
    from: PartyType.WAREHOUSE,
    to: PartyType.SUPERVISOR,
    allowedFromStatuses: [MachineStatus.IN_COMPANY_WAREHOUSE],
    resultStatus: MachineStatus.IN_BRANCH_WAREHOUSE,
    direction: TransferDirection.OUT,
    signatures: [SignaturePartyRole.RECEIVER],
    requiredPermission: Perm.TRANSFERS_CREATE,
  },
  [TransferType.BRANCH_TO_REPRESENTATIVE]: {
    from: PartyType.SUPERVISOR,
    to: PartyType.REPRESENTATIVE,
    allowedFromStatuses: [MachineStatus.IN_BRANCH_WAREHOUSE, MachineStatus.WITH_SUPERVISOR],
    resultStatus: MachineStatus.WITH_REPRESENTATIVE,
    direction: TransferDirection.OUT,
    signatures: [SignaturePartyRole.RECEIVER],
    requiredPermission: Perm.TRANSFERS_CREATE,
    sameBranchRequired: true,
  },
  [TransferType.REPRESENTATIVE_TO_MERCHANT]: {
    from: PartyType.REPRESENTATIVE,
    to: PartyType.MERCHANT,
    allowedFromStatuses: [MachineStatus.WITH_REPRESENTATIVE],
    resultStatus: MachineStatus.WITH_MERCHANT,
    direction: TransferDirection.OUT,
    signatures: [SignaturePartyRole.SENDER],
    requiredPermission: Perm.TRANSFERS_CREATE,
    autoConfirm: true,
  },
  [TransferType.MERCHANT_TO_REPRESENTATIVE]: {
    from: PartyType.MERCHANT,
    to: PartyType.REPRESENTATIVE,
    allowedFromStatuses: [MachineStatus.WITH_MERCHANT],
    resultStatus: MachineStatus.WITH_REPRESENTATIVE,
    direction: TransferDirection.RETURN,
    signatures: [SignaturePartyRole.RECEIVER],
    requiredPermission: Perm.TRANSFERS_CREATE,
    autoConfirm: true,
    runViolationChecks: true,
  },
  [TransferType.REPRESENTATIVE_TO_BRANCH]: {
    from: PartyType.REPRESENTATIVE,
    to: PartyType.SUPERVISOR,
    allowedFromStatuses: [MachineStatus.WITH_REPRESENTATIVE],
    resultStatus: MachineStatus.IN_BRANCH_WAREHOUSE,
    direction: TransferDirection.RETURN,
    signatures: [SignaturePartyRole.RECEIVER],
    requiredPermission: Perm.TRANSFERS_CREATE,
    sameBranchRequired: true,
    runViolationChecks: true,
  },
  [TransferType.BRANCH_TO_COMPANY]: {
    from: PartyType.SUPERVISOR,
    to: PartyType.WAREHOUSE,
    allowedFromStatuses: [MachineStatus.IN_BRANCH_WAREHOUSE, MachineStatus.WITH_SUPERVISOR],
    resultStatus: MachineStatus.IN_COMPANY_WAREHOUSE,
    direction: TransferDirection.RETURN,
    signatures: [SignaturePartyRole.RECEIVER],
    requiredPermission: Perm.TRANSFERS_CREATE,
    runViolationChecks: true,
    toWarehouseTypes: [WarehouseType.COMPANY_MAIN],
  },
  [TransferType.COMPANY_TO_MAINTENANCE]: {
    from: PartyType.WAREHOUSE,
    to: PartyType.WAREHOUSE,
    allowedFromStatuses: [MachineStatus.IN_COMPANY_WAREHOUSE],
    resultStatus: MachineStatus.UNDER_MAINTENANCE,
    direction: TransferDirection.OUT,
    signatures: [SignaturePartyRole.RECEIVER],
    requiredPermission: Perm.TRANSFERS_CREATE,
    toWarehouseTypes: [WarehouseType.MAINTENANCE],
  },
  [TransferType.MAINTENANCE_TO_COMPANY]: {
    from: PartyType.WAREHOUSE,
    to: PartyType.WAREHOUSE,
    allowedFromStatuses: [MachineStatus.UNDER_MAINTENANCE],
    resultStatus: MachineStatus.IN_COMPANY_WAREHOUSE,
    direction: TransferDirection.RETURN,
    signatures: [SignaturePartyRole.RECEIVER],
    requiredPermission: Perm.TRANSFERS_CREATE,
    toWarehouseTypes: [WarehouseType.COMPANY_MAIN],
  },
  [TransferType.COMPANY_TO_FACTORY]: {
    from: PartyType.WAREHOUSE,
    to: PartyType.FACTORY,
    allowedFromStatuses: [MachineStatus.IN_COMPANY_WAREHOUSE],
    resultStatus: MachineStatus.AT_FACTORY,
    direction: TransferDirection.OUT,
    signatures: [SignaturePartyRole.SENDER],
    requiredPermission: Perm.TRANSFERS_CREATE,
    autoConfirm: true,
    toPartyOptional: true,
  },
  [TransferType.FACTORY_TO_COMPANY_RETURN]: {
    from: PartyType.FACTORY,
    to: PartyType.WAREHOUSE,
    allowedFromStatuses: [MachineStatus.AT_FACTORY],
    resultStatus: MachineStatus.IN_COMPANY_WAREHOUSE,
    direction: TransferDirection.RETURN,
    signatures: [SignaturePartyRole.RECEIVER],
    requiredPermission: Perm.TRANSFERS_CREATE,
    toWarehouseTypes: [WarehouseType.COMPANY_MAIN],
  },
  [TransferType.COMPANY_TO_SERVICE_CENTER]: {
    from: PartyType.WAREHOUSE,
    to: PartyType.SERVICE_CENTER,
    allowedFromStatuses: [MachineStatus.IN_COMPANY_WAREHOUSE],
    resultStatus: MachineStatus.AT_SERVICE_CENTER,
    direction: TransferDirection.OUT,
    signatures: [SignaturePartyRole.SENDER],
    requiredPermission: Perm.TRANSFERS_CREATE,
    autoConfirm: true,
    toPartyOptional: true,
  },
  [TransferType.SERVICE_CENTER_TO_COMPANY]: {
    from: PartyType.SERVICE_CENTER,
    to: PartyType.WAREHOUSE,
    allowedFromStatuses: [MachineStatus.AT_SERVICE_CENTER],
    resultStatus: MachineStatus.IN_COMPANY_WAREHOUSE,
    direction: TransferDirection.RETURN,
    signatures: [SignaturePartyRole.RECEIVER],
    requiredPermission: Perm.TRANSFERS_CREATE,
    toWarehouseTypes: [WarehouseType.COMPANY_MAIN],
  },
  [TransferType.COMPANY_TO_SCRAP]: {
    from: PartyType.WAREHOUSE,
    to: PartyType.WAREHOUSE,
    allowedFromStatuses: [MachineStatus.IN_COMPANY_WAREHOUSE],
    resultStatus: MachineStatus.DECOMMISSIONED,
    direction: TransferDirection.OUT,
    signatures: [SignaturePartyRole.SENDER],
    requiredPermission: Perm.TRANSFERS_CREATE,
    autoConfirm: true,
    toWarehouseTypes: [WarehouseType.SCRAP],
  },
};

/**
 * Which party the *sender* is for a given type, expressed as the roles allowed to create it. A
 * representative cannot invent a `COMPANY_TO_BRANCH`, even though he holds `transfers.create`,
 * because he is not the warehouse.
 */
export function senderPartyFor(type: TransferType): PartyType {
  return TRANSFER_RULES[type].from;
}

export function receiverPartyFor(type: TransferType): PartyType {
  return TRANSFER_RULES[type].to;
}

/**
 * True when the person creating the transfer is also its receiver, so there is nobody to
 * pick and nothing to sign for but himself.
 *
 * This is the merchant-return leg. The merchant has no account, so the representative
 * standing in the shop books the machine back in — he is the receiving party by definition.
 * Derived rather than declared: an auto-confirming leg closes on the creator's signature
 * alone, so if its receiver is a person, that person can only be the creator.
 */
export function receiverIsCreator(rule: TransferRule): boolean {
  return rule.autoConfirm === true && USER_PARTIES.includes(rule.to);
}

/** A transfer whose receiver is a real account is the only kind with an inbox entry. */
export function requiresReceiverAccount(type: TransferType): boolean {
  const rule = TRANSFER_RULES[type];
  return !rule.autoConfirm && rule.to !== PartyType.FACTORY;
}
