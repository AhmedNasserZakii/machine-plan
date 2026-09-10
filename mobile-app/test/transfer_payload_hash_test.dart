import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_state.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_payload_hash.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';

MachineEntity _machine(String id) => MachineEntity(
  id: id,
  serial: id,
  status: MachineStatus.withRepresentative,
  hasBox: false,
  type: const MachineTypeRef(id: 't1', name: 'Type', requiresSim: false),
  model: const MachineModelRef(id: 'mo1', name: 'Model'),
  warranty: const MachineWarranty(),
);

/// Cross-checked against the backend's `hashTransferPayload`
/// (`transfer-payload.ts` + `sha256Object`, `hash.util.ts`) for this exact
/// input via a standalone node script — the two must never diverge, since
/// this is the same canonical snapshot the server hashes.
void main() {
  test('matches the backend canonical hash for a fixed payload', () {
    final List<DraftItem> items = <DraftItem>[
      DraftItem(
        machine: _machine('b-machine'),
        params: const TransferItemParams(
          machineId: 'b-machine',
          batterySerialScanned: 'BT-1',
        ),
      ),
      DraftItem(
        machine: _machine('a-machine'),
        params: const TransferItemParams(
          machineId: 'a-machine',
          hasCharger: false,
          hasBox: true,
          condition: ItemCondition.damaged,
        ),
      ),
    ];

    expect(
      TransferPayloadHash.compute(items),
      '1640b7adcf53991427d474d9f71179c0aa59b38657e34f009d0ec575c1c4a554',
    );
  });

  test('is independent of item order', () {
    final DraftItem a = DraftItem(
      machine: _machine('a-machine'),
      params: const TransferItemParams(
        machineId: 'a-machine',
        hasCharger: false,
        hasBox: true,
        condition: ItemCondition.damaged,
      ),
    );
    final DraftItem b = DraftItem(
      machine: _machine('b-machine'),
      params: const TransferItemParams(
        machineId: 'b-machine',
        batterySerialScanned: 'BT-1',
      ),
    );

    expect(
      TransferPayloadHash.compute(<DraftItem>[a, b]),
      TransferPayloadHash.compute(<DraftItem>[b, a]),
    );
  });

  test('treats a blank scanned serial the same as none', () {
    final DraftItem blank = DraftItem(
      machine: _machine('a-machine'),
      params: const TransferItemParams(
        machineId: 'a-machine',
        batterySerialScanned: '   ',
      ),
    );
    final DraftItem none = DraftItem(
      machine: _machine('a-machine'),
      params: const TransferItemParams(machineId: 'a-machine'),
    );

    expect(
      TransferPayloadHash.compute(<DraftItem>[blank]),
      TransferPayloadHash.compute(<DraftItem>[none]),
    );
  });
}
