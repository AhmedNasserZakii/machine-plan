import { ItemCondition } from 'src/common/enums/transfer.enum';
import { TransferItem } from '../entities/transfer-item.entity';
import { buildTransferPayload, hashTransferPayload } from '../transfer-payload';

function item(overrides: Partial<TransferItem> = {}): TransferItem {
  return {
    machineId: '11111111-1111-4111-8111-111111111111',
    batterySerialScanned: 'BT-1',
    simSerialScanned: null,
    boxSerialScanned: null,
    hasCharger: true,
    hasBox: false,
    condition: ItemCondition.GOOD,
    notes: null,
    ...overrides,
  } as TransferItem;
}

describe('transfer payload hash', () => {
  it('does not depend on the order rows come back in', () => {
    const a = item({ machineId: 'aaaaaaaa-1111-4111-8111-111111111111' });
    const b = item({ machineId: 'bbbbbbbb-1111-4111-8111-111111111111' });

    expect(hashTransferPayload([a, b])).toBe(hashTransferPayload([b, a]));
  });

  /** The receiver signs for accessories and condition, so changing either invalidates the hash. */
  it('changes when anything the receiver can verify changes', () => {
    const base = hashTransferPayload([item()]);

    expect(hashTransferPayload([item({ hasCharger: false })])).not.toBe(base);
    expect(hashTransferPayload([item({ hasBox: true })])).not.toBe(base);
    expect(hashTransferPayload([item({ condition: ItemCondition.DAMAGED })])).not.toBe(base);
    expect(hashTransferPayload([item({ batterySerialScanned: 'BT-2' })])).not.toBe(base);
    expect(hashTransferPayload([item({ simSerialScanned: '8920' })])).not.toBe(base);
  });

  /**
   * Notes are commentary, not evidence. Including them would make the sender's typo fix look
   * identical to a swapped battery, which is exactly the distinction the hash exists to draw.
   */
  it('ignores notes and anything the client cannot observe', () => {
    const base = hashTransferPayload([item()]);

    expect(hashTransferPayload([item({ notes: 'left at the gate' })])).toBe(base);
    expect(hashTransferPayload([item({ id: 'anything' })])).toBe(base);
  });

  it('distinguishes an unscanned serial from an empty one', () => {
    const unscanned = hashTransferPayload([item({ boxSerialScanned: null })]);
    const scannedBlank = hashTransferPayload([item({ boxSerialScanned: '' })]);

    expect(unscanned).not.toBe(scannedBlank);
  });

  it('exposes exactly the fields a person can check against the machines in front of them', () => {
    expect(Object.keys(buildTransferPayload([item()])[0]).sort()).toEqual([
      'batterySerialScanned',
      'boxSerialScanned',
      'condition',
      'hasBox',
      'hasCharger',
      'machineId',
      'simSerialScanned',
    ]);
  });
});
