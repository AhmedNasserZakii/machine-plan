import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/data/logic/confirm_transfer/confirm_transfer_state.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';

TransferItemEntity _item(
  String id, {
  bool hasCharger = true,
  bool? batteryMatches,
}) => TransferItemEntity(
  id: id,
  machine: TransferMachineRefEntity(id: 'm-$id', serial: 'SN-$id'),
  hasCharger: hasCharger,
  hasBox: false,
  condition: ItemCondition.good,
  batteryMatches: batteryMatches,
);

TransferEntity _transfer(List<TransferItemEntity> items) => TransferEntity(
  id: 't1',
  referenceNo: 'REF-1',
  type: TransferType.branchToRepresentative,
  direction: TransferDirection.out,
  status: TransferStatus.pending,
  from: const TransferPartyEntity(type: PartyType.supervisor),
  to: const TransferPartyEntity(type: PartyType.representative),
  occurredAt: DateTime(2026),
  itemsCount: items.length,
  createdAt: DateTime(2026),
  items: items,
);

/// The confirm screen's recomputed summary (`9.4`) leads with these three
/// counts — worth pinning the recomputation logic down directly, since it is
/// the whole point of showing it above the signature pad rather than trusting
/// the sender's stale declaration.
void main() {
  test('missingChargerCount reflects the adjustment, not the original row', () {
    final ConfirmTransferState restored = ConfirmTransferState(
      transfer: _transfer(<TransferItemEntity>[_item('a', hasCharger: false)]),
      adjustments: const <String, ItemAdjustmentParams>{
        'a': ItemAdjustmentParams(transferItemId: 'a', hasCharger: true),
      },
    );
    final ConfirmTransferState discovered = ConfirmTransferState(
      transfer: _transfer(<TransferItemEntity>[_item('a')]),
      adjustments: const <String, ItemAdjustmentParams>{
        'a': ItemAdjustmentParams(transferItemId: 'a', hasCharger: false),
      },
    );
    final ConfirmTransferState untouched = ConfirmTransferState(
      transfer: _transfer(<TransferItemEntity>[_item('a', hasCharger: false)]),
    );

    expect(restored.missingChargerCount, 0);
    expect(discovered.missingChargerCount, 1);
    expect(untouched.missingChargerCount, 1);
  });

  test(
    'mismatchCount drops a row once its battery serial has been corrected',
    () {
      final ConfirmTransferState corrected = ConfirmTransferState(
        transfer: _transfer(<TransferItemEntity>[
          _item('a', batteryMatches: false),
        ]),
        adjustments: const <String, ItemAdjustmentParams>{
          'a': ItemAdjustmentParams(
            transferItemId: 'a',
            batterySerialScanned: 'BT-CORRECTED',
          ),
        },
      );
      final ConfirmTransferState stillMismatched = ConfirmTransferState(
        transfer: _transfer(<TransferItemEntity>[
          _item('a', batteryMatches: false),
        ]),
      );
      final ConfirmTransferState untouchedButAdjustedElsewhere =
          ConfirmTransferState(
            transfer: _transfer(<TransferItemEntity>[
              _item('a', batteryMatches: false),
            ]),
            adjustments: const <String, ItemAdjustmentParams>{
              'a': ItemAdjustmentParams(transferItemId: 'a', hasCharger: false),
            },
          );

      expect(corrected.mismatchCount, 0);
      expect(stillMismatched.mismatchCount, 1);
      expect(untouchedButAdjustedElsewhere.mismatchCount, 1);
    },
  );

  test('adjustedCount only counts rows with a non-empty adjustment', () {
    final ConfirmTransferState state = ConfirmTransferState(
      transfer: _transfer(<TransferItemEntity>[_item('a'), _item('b')]),
      adjustments: const <String, ItemAdjustmentParams>{
        'a': ItemAdjustmentParams(transferItemId: 'a', hasCharger: false),
        'b': ItemAdjustmentParams(transferItemId: 'b'),
      },
    );

    expect(state.adjustedCount, 1);
  });
}
