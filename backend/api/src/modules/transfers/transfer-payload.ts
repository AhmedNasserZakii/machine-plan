import { sha256Object } from 'src/common/utils';
import { TransferItem } from './entities/transfer-item.entity';

/**
 * The canonical snapshot a signature is taken against.
 *
 * The receiver's device hashes exactly this shape from what it rendered; the server rebuilds it
 * from the rows as they stand at confirm time. If the two disagree, the sender edited the document
 * between display and signature, and the receiver is made to look again rather than sign for a list
 * he never saw.
 *
 * Only the fields a person can verify by looking at the machines are included. Timestamps and ids
 * that the client cannot observe would make the hash impossible to reproduce; `notes` is excluded
 * for the same reason it is not evidence — it is commentary.
 */
export interface TransferPayloadItem {
  machineId: string;
  batterySerialScanned: string | null;
  simSerialScanned: string | null;
  boxSerialScanned: string | null;
  hasCharger: boolean;
  hasBox: boolean;
  condition: string;
}

export function buildTransferPayload(items: TransferItem[]): TransferPayloadItem[] {
  return (
    items
      .map((item) => ({
        machineId: item.machineId,
        batterySerialScanned: item.batterySerialScanned,
        simSerialScanned: item.simSerialScanned,
        boxSerialScanned: item.boxSerialScanned,
        hasCharger: item.hasCharger,
        hasBox: item.hasBox,
        condition: item.condition,
      }))
      // Row order is whatever the database felt like returning; the hash must not depend on it.
      .sort((a, b) => (a.machineId < b.machineId ? -1 : a.machineId > b.machineId ? 1 : 0))
  );
}

export function hashTransferPayload(items: TransferItem[]): string {
  return sha256Object(buildTransferPayload(items));
}
