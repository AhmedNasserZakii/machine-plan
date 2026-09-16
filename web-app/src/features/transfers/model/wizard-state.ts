import { z } from 'zod';

import type { ItemCondition, ReceiverKind, TransferType } from './types';

export const WIZARD_STORAGE_KEY = 'transfers.wizard.v1';

export type WizardDraftItem = {
  machineId: string;
  serial: string;
  modelName?: string | null;
  batterySerialExpected?: string | null;
  simSerialExpected?: string | null;
  boxSerialExpected?: string | null;
  batterySerialScanned?: string;
  simSerialScanned?: string;
  boxSerialScanned?: string;
  hasCharger: boolean;
  hasBox: boolean;
  condition: ItemCondition;
  notes?: string;
  photoMediaIds: string[];
  /** Explicit ack when a scanned accessory does not match the record. */
  accessoryMismatchAcknowledged: boolean;
};

export type WizardState = {
  step: 1 | 2 | 3 | 4;
  type?: TransferType;
  receiverKind?: ReceiverKind;
  selfAttestedType: boolean;
  allowedFromStatuses: string[];
  toPartyId?: string;
  recipientLabel?: string;
  items: WizardDraftItem[];
  notes?: string;
  /** User checked the self-attested consequence checkbox (never defaulted on). */
  selfAttestedAck: boolean;
  /** Confirmed SIGNATURE media id from the pad upload. */
  signatureMediaId?: string;
  clientUuid: string;
};

export const wizardDraftItemSchema = z.object({
  machineId: z.string().uuid(),
  serial: z.string().min(1),
  modelName: z.string().nullable().optional(),
  batterySerialExpected: z.string().nullable().optional(),
  simSerialExpected: z.string().nullable().optional(),
  boxSerialExpected: z.string().nullable().optional(),
  batterySerialScanned: z.string().optional(),
  simSerialScanned: z.string().optional(),
  boxSerialScanned: z.string().optional(),
  hasCharger: z.boolean(),
  hasBox: z.boolean(),
  condition: z.enum(['GOOD', 'DAMAGED', 'NOT_WORKING']),
  notes: z.string().optional(),
  photoMediaIds: z.array(z.string().uuid()),
  accessoryMismatchAcknowledged: z.boolean(),
});

export const wizardStateSchema = z.object({
  step: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  type: z.string().optional(),
  receiverKind: z.enum(['USER', 'WAREHOUSE', 'MERCHANT', 'NONE']).optional(),
  selfAttestedType: z.boolean(),
  allowedFromStatuses: z.array(z.string()),
  toPartyId: z.string().optional(),
  recipientLabel: z.string().optional(),
  items: z.array(wizardDraftItemSchema),
  notes: z.string().optional(),
  selfAttestedAck: z.boolean(),
  signatureMediaId: z.string().optional(),
  clientUuid: z.string().uuid(),
});

export function createEmptyWizardState(clientUuid: string): WizardState {
  return {
    step: 1,
    selfAttestedType: false,
    allowedFromStatuses: [],
    items: [],
    selfAttestedAck: false,
    clientUuid,
  };
}

export function loadWizardState(): WizardState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = wizardStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as WizardState) : null;
  } catch {
    return null;
  }
}

export function saveWizardState(state: WizardState): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(state));
}

export function clearWizardState(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(WIZARD_STORAGE_KEY);
}

export function itemHasAccessoryMismatch(item: WizardDraftItem): boolean {
  const checks: Array<[string | undefined, string | null | undefined]> = [
    [item.batterySerialScanned, item.batterySerialExpected],
    [item.simSerialScanned, item.simSerialExpected],
    [item.boxSerialScanned, item.boxSerialExpected],
  ];
  return checks.some(([scanned, expected]) => {
    const s = scanned?.trim();
    const e = expected?.trim();
    if (!s || !e) return false;
    return s !== e;
  });
}

export function toTransferItemDto(item: WizardDraftItem) {
  return {
    machineId: item.machineId,
    hasCharger: item.hasCharger,
    hasBox: item.hasBox,
    condition: item.condition,
    ...(item.batterySerialScanned?.trim()
      ? { batterySerialScanned: item.batterySerialScanned.trim() }
      : {}),
    ...(item.simSerialScanned?.trim() ? { simSerialScanned: item.simSerialScanned.trim() } : {}),
    ...(item.boxSerialScanned?.trim() ? { boxSerialScanned: item.boxSerialScanned.trim() } : {}),
    ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
    ...(item.photoMediaIds.length ? { photoMediaIds: item.photoMediaIds } : {}),
  };
}
