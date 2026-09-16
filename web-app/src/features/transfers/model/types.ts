import type { Schema } from '@/lib/api/types';

export type TransferListItem = Schema<'TransferListItemResponse'>;
export type Transfer = Schema<'TransferResponse'>;
export type TransferItem = Schema<'TransferItemResponse'>;
export type TransferSignature = Schema<'TransferSignatureResponse'>;
export type CreatableTransferType = Schema<'CreatableTransferTypeResponse'>;
export type TransferRecipient = Schema<'TransferRecipientResponse'>;
export type TransferValidation = Schema<'TransferValidationResponse'>;
export type CreateTransferBody = Schema<'CreateTransferDto'>;
export type ConfirmTransferBody = Schema<'ConfirmTransferDto'>;
export type RejectTransferBody = Schema<'RejectTransferDto'>;
export type CancelTransferBody = Schema<'CancelTransferDto'>;
export type TransferItemDto = Schema<'TransferItemDto'>;
export type SignatureDto = Schema<'SignatureDto'>;
export type TransferSignatureMedia = Schema<'TransferSignatureMediaResponse'>;

export type TransferType = TransferListItem['type'];
export type TransferStatus = TransferListItem['status'];
export type ItemCondition = TransferItemDto['condition'];
export type ReceiverKind = CreatableTransferType['receiverKind'];
export type MachineStatus = CreatableTransferType['allowedFromStatuses'][number];

export type TransfersView = 'all' | 'incoming' | 'outgoing';

export type TransferValidationProblem = {
  field?: string;
  constraint?: string;
  value?: unknown;
  machineId?: string;
  serial?: string;
};

/** Pending transfers older than this (ms) get a stuck-age warning tone (matches TRANSFER_STUCK at 72h). */
export const TRANSFER_STUCK_AGE_MS = 72 * 60 * 60 * 1000;

/** Client-side cancel window hint; server enforces CANCEL_WINDOW_EXPIRED. */
export const TRANSFER_CANCEL_WINDOW_MS = 60 * 60 * 1000;

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function partyName(party: TransferListItem['from'] | TransferListItem['to']): string {
  return asString(party.name) ?? party.type;
}

export function isTransferStuck(createdAt: string, status: TransferStatus): boolean {
  if (status !== 'PENDING') return false;
  return Date.now() - new Date(createdAt).getTime() >= TRANSFER_STUCK_AGE_MS;
}

export function isWithinCancelWindow(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < TRANSFER_CANCEL_WINDOW_MS;
}

export function parseValidationProblems(problems: unknown[]): TransferValidationProblem[] {
  return problems.map((raw) => {
    if (!raw || typeof raw !== 'object') return { constraint: String(raw) };
    const row = raw as Record<string, unknown>;
    const value = row.value;
    const valueObj =
      value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
    return {
      field: typeof row.field === 'string' ? row.field : undefined,
      constraint:
        typeof row.constraint === 'string'
          ? row.constraint
          : typeof row.code === 'string'
            ? row.code
            : undefined,
      value,
      machineId:
        typeof valueObj?.machineId === 'string'
          ? valueObj.machineId
          : typeof row.machineId === 'string'
            ? row.machineId
            : undefined,
      serial: typeof valueObj?.serial === 'string' ? valueObj.serial : undefined,
    };
  });
}
