import { Locale } from 'src/common/constants/locales';
import { PartyType } from 'src/common/enums/transfer.enum';
import { pickTranslation } from 'src/common/utils';
import {
  TransferItemResponse,
  TransferListItemResponse,
  TransferPartyResponse,
  TransferResponse,
  TransferSignatureResponse,
} from '../dto/responses/transfer.response';
import { Transfer } from '../entities/transfer.entity';
import { TransferItem } from '../entities/transfer-item.entity';
import { TransferSignature } from '../entities/transfer-signature.entity';
import { hashTransferPayload } from '../transfer-payload';

/**
 * `loadRelationCountAndMap` writes a property TypeORM has no column for, so the entity does not
 * declare it. Reading it back needs this narrowing rather than a cast at each call site.
 */
type WithItemsCount = Transfer & { itemsCount?: number };

export function toTransferListItemResponse(transfer: Transfer): TransferListItemResponse {
  const withCount = transfer as WithItemsCount;

  return {
    id: transfer.id,
    referenceNo: transfer.referenceNo,
    type: transfer.type,
    direction: transfer.direction,
    status: transfer.status,
    from: toParty(transfer.fromPartyType, transfer.fromPartyId, senderName(transfer)),
    to: toParty(transfer.toPartyType, transfer.toPartyId, null),
    branch: transfer.branch ? { id: transfer.branch.id, name: transfer.branch.name } : null,
    occurredAt: transfer.occurredAt.toISOString(),
    confirmedAt: transfer.confirmedAt?.toISOString() ?? null,
    itemsCount: withCount.itemsCount ?? transfer.items?.length ?? 0,
    createdAt: transfer.createdAt.toISOString(),
  };
}

export function toTransferResponse(transfer: Transfer, locale: Locale): TransferResponse {
  const items = transfer.items ?? [];

  return {
    ...toTransferListItemResponse(transfer),
    itemsCount: items.length,
    items: items.map((item) => toItemResponse(item, locale)),
    signatures: (transfer.signatures ?? []).map(toSignatureResponse),
    violationsCount: items.filter(hasMismatch).length,
    rejectionReason: transfer.rejectionReason,
    notes: transfer.notes,
    payloadHash: hashTransferPayload(items),
  };
}

function toItemResponse(item: TransferItem, locale: Locale): TransferItemResponse {
  return {
    id: item.id,
    machine: {
      id: item.machineId,
      serial: item.machine?.serial ?? '',
      model: item.machine?.machineModel
        ? (pickTranslation(item.machine.machineModel.translations, locale)?.name ??
          item.machine.machineModel.code)
        : null,
    },
    batterySerialScanned: item.batterySerialScanned,
    batteryMatches: item.batteryMatches,
    simSerialScanned: item.simSerialScanned,
    simMatches: item.simMatches,
    boxSerialScanned: item.boxSerialScanned,
    boxMatches: item.boxMatches,
    hasCharger: item.hasCharger,
    hasBox: item.hasBox,
    condition: item.condition,
    notes: item.notes,
    photos: (item.photos ?? []).map((photo) => ({ id: photo.id, mediaId: photo.mediaId })),
  };
}

function toSignatureResponse(signature: TransferSignature): TransferSignatureResponse {
  return {
    id: signature.id,
    partyRole: signature.partyRole,
    userId: signature.userId,
    userFullName: signature.user?.fullName ?? null,
    method: signature.method,
    signatureMediaId: signature.signatureMediaId,
    signedAt: signature.signedAt.toISOString(),
    deviceModel: signature.deviceModel,
    payloadHash: signature.payloadHash,
  };
}

function toParty(type: PartyType, id: string | null, name: string | null): TransferPartyResponse {
  return { type, id, name };
}

/** Only the initiator is joined on the list query; the receiving side resolves on detail. */
function senderName(transfer: Transfer): string | null {
  return transfer.initiatedBy?.fullName ?? null;
}

/** A recorded `false` is a mismatch; `null` just means nobody scanned it. */
function hasMismatch(item: TransferItem): boolean {
  return item.batteryMatches === false || item.simMatches === false || item.boxMatches === false;
}
