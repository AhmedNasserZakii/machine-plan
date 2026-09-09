import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/data/models/transfer_response_model.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';
import 'package:machinery/feature/transfers/domain/params/transfers_query_params.dart';

/// Payloads copied from the running API.
///
/// The list row and the detail document are different shapes — the row has no
/// items, signatures or payload hash — and the tri-state match flags mean three
/// different things. All of that fails silently at runtime, so it is pinned.
void main() {
  Map<String, dynamic> decode(String body) =>
      jsonDecode(body) as Map<String, dynamic>;

  test('GET /transfers row parses parties, counts and dates', () {
    final TransferEntity transfer = TransferResponseModel.fromJson(
      decode('''
{
  "id": "3c1f0a9e-4b21-4d0e-9a76-2f1c8d5b7e10",
  "referenceNo": "TRF-2026-000412",
  "type": "BRANCH_TO_REPRESENTATIVE",
  "direction": "OUT",
  "status": "PENDING",
  "from": { "type": "SUPERVISOR", "id": "9a1e", "name": "مشرف الإسكندرية" },
  "to": { "type": "REPRESENTATIVE", "id": "4c7d", "name": "محمود عبد الله" },
  "branch": { "id": "84177053", "name": "فرع الإسكندرية" },
  "occurredAt": "2026-09-05T08:30:00.000Z",
  "confirmedAt": null,
  "itemsCount": 12,
  "createdAt": "2026-09-05T11:02:41.000Z"
}
'''),
    ).toEntity();

    expect(transfer.referenceNo, 'TRF-2026-000412');
    expect(transfer.type, TransferType.branchToRepresentative);
    expect(transfer.direction, TransferDirection.out);
    expect(transfer.status, TransferStatus.pending);
    expect(transfer.isPending, isTrue);
    expect(transfer.from.type, PartyType.supervisor);
    expect(transfer.to.name, 'محمود عبد الله');
    expect(transfer.branchName, 'فرع الإسكندرية');
    expect(transfer.itemsCount, 12);
    expect(transfer.confirmedAt, isNull);

    // The hand-off happened hours before it was synced, which is the normal
    // case in the field and must not be flattened to one timestamp.
    expect(transfer.occurredAt.isBefore(transfer.createdAt), isTrue);

    // A list row carries no items; the screen must not assume otherwise.
    expect(transfer.items, isEmpty);
    expect(transfer.payloadHash, isNull);
  });

  test('a detail document parses items, photos and signatures', () {
    final TransferEntity transfer = TransferResponseModel.fromJson(
      decode('''
{
  "id": "3c1f0a9e",
  "referenceNo": "TRF-2026-000412",
  "type": "MERCHANT_TO_REPRESENTATIVE",
  "direction": "RETURN",
  "status": "CONFIRMED",
  "from": { "type": "MERCHANT", "id": "m-88", "name": "بقالة النور" },
  "to": { "type": "REPRESENTATIVE", "id": "4c7d", "name": "محمود عبد الله" },
  "branch": { "id": "8417", "name": "فرع الإسكندرية" },
  "occurredAt": "2026-09-05T08:30:00.000Z",
  "confirmedAt": "2026-09-05T08:31:12.000Z",
  "itemsCount": 2,
  "createdAt": "2026-09-05T08:31:00.000Z",
  "violationsCount": 1,
  "rejectionReason": null,
  "notes": "استلمت من المحل",
  "payloadHash": "b6f1c0d2e39a4471",
  "items": [
    {
      "id": "item-1",
      "machine": { "id": "mac-1", "serial": "SN-1009", "model": "إنجينيكو ديسك 5000" },
      "batterySerialScanned": "BT-99999",
      "batteryMatches": false,
      "simSerialScanned": null,
      "simMatches": null,
      "boxSerialScanned": null,
      "boxMatches": null,
      "hasCharger": false,
      "hasBox": true,
      "condition": "DAMAGED",
      "notes": "الشاشة مخدوشة",
      "photos": [{ "id": "p1", "mediaId": "media-1" }]
    },
    {
      "id": "item-2",
      "machine": { "id": "mac-2", "serial": "SN-1010", "model": null },
      "batterySerialScanned": "BT-1010",
      "batteryMatches": true,
      "simSerialScanned": null,
      "simMatches": null,
      "boxSerialScanned": null,
      "boxMatches": null,
      "hasCharger": true,
      "hasBox": false,
      "condition": "GOOD",
      "notes": null,
      "photos": []
    }
  ],
  "signatures": [
    {
      "partyRole": "RECEIVER",
      "userId": "4c7d",
      "userFullName": "محمود عبد الله",
      "method": "DRAWN_SIGNATURE",
      "signatureMediaId": "media-sig",
      "signedAt": "2026-09-05T08:31:12.000Z",
      "deviceModel": "Redmi 9A",
      "payloadHash": "b6f1c0d2e39a4471"
    }
  ]
}
'''),
    ).toEntity();

    expect(transfer.items, hasLength(2));
    expect(transfer.violationsCount, 1);
    expect(transfer.payloadHash, 'b6f1c0d2e39a4471');

    final TransferItemEntity damaged = transfer.items.first;
    expect(damaged.condition, ItemCondition.damaged);
    expect(damaged.hasCharger, isFalse);
    expect(damaged.photoMediaIds, <String>['media-1']);

    // The unit came back carrying somebody else's battery. That is a recorded
    // fact, not a refusal — the transfer confirmed anyway.
    expect(damaged.batteryMatches, isFalse);
    expect(damaged.hasMismatch, isTrue);
    expect(transfer.status, TransferStatus.confirmed);

    final TransferItemEntity clean = transfer.items.last;
    expect(clean.hasMismatch, isFalse);
    expect(clean.machine.model, isNull);

    expect(transfer.signatures.single.partyRole, SignaturePartyRole.receiver);
    expect(transfer.signatures.single.method, SignatureMethod.drawn);
  });

  test('an unscanned serial is null, not a mismatch', () {
    final TransferEntity transfer = TransferResponseModel.fromJson(
      decode('''
{
  "id": "t1",
  "referenceNo": "TRF-1",
  "type": "COMPANY_TO_BRANCH",
  "direction": "OUT",
  "status": "PENDING",
  "from": { "type": "WAREHOUSE", "id": null, "name": null },
  "to": { "type": "SUPERVISOR", "id": "s1", "name": "مشرف" },
  "branch": null,
  "occurredAt": "2026-09-05T08:30:00.000Z",
  "confirmedAt": null,
  "itemsCount": 1,
  "createdAt": "2026-09-05T08:30:00.000Z",
  "items": [
    {
      "id": "i1",
      "machine": { "id": "m1", "serial": "SN-1", "model": null },
      "batterySerialScanned": null,
      "batteryMatches": null,
      "simSerialScanned": null,
      "simMatches": null,
      "boxSerialScanned": null,
      "boxMatches": null,
      "hasCharger": true,
      "hasBox": false,
      "condition": "GOOD",
      "notes": null,
      "photos": []
    }
  ],
  "signatures": []
}
'''),
    ).toEntity();

    final TransferItemEntity item = transfer.items.single;

    // Three distinct states, and only `false` is an accusation.
    expect(item.batteryMatches, isNull);
    expect(item.hasMismatch, isFalse);

    // The company warehouse has no record behind it, so the name stays null and
    // the screen falls back to the party label.
    expect(transfer.from.name, isNull);
    expect(transfer.from.type, PartyType.warehouse);
    expect(transfer.branchName, isNull);
  });

  test('an unknown type from a newer server degrades instead of throwing', () {
    final TransferEntity transfer = TransferResponseModel.fromJson(
      decode('''
{
  "id": "t1",
  "referenceNo": "TRF-1",
  "type": "COMPANY_TO_SOMETHING_NEW",
  "direction": "SIDEWAYS",
  "status": "PENDING",
  "from": { "type": "WAREHOUSE", "id": null, "name": null },
  "to": { "type": "WAREHOUSE", "id": null, "name": null },
  "occurredAt": "2026-09-05T08:30:00.000Z",
  "itemsCount": 0,
  "createdAt": "2026-09-05T08:30:00.000Z"
}
'''),
    ).toEntity();

    expect(transfer.type, TransferType.unknown);
    expect(transfer.direction, TransferDirection.unknown);
    expect(transfer.status, TransferStatus.pending);
  });

  group('what the app sends', () {
    test('an item omits serials nobody scanned', () {
      const TransferItemParams item = TransferItemParams(machineId: 'm1');

      final Map<String, dynamic> json = item.toJson();

      expect(json['machineId'], 'm1');
      expect(json['hasCharger'], isTrue);
      expect(json['condition'], 'GOOD');

      // An empty string would be recorded as a mismatch against the bonded
      // battery, so an unscanned serial must be absent rather than blank.
      expect(json.containsKey('batterySerialScanned'), isFalse);
      expect(json.containsKey('photoMediaIds'), isFalse);
    });

    test('a create carries the client uuid that makes a retry safe', () {
      final CreateTransferParams params = CreateTransferParams(
        clientUuid: 'f1e2d3c4',
        type: TransferType.companyToBranch,
        occurredAt: DateTime.utc(2026, 9, 5, 8, 30),
        toPartyId: 's1',
        items: const <TransferItemParams>[
          TransferItemParams(machineId: 'm1', batterySerialScanned: ' BT-1 '),
        ],
      );

      final Map<String, dynamic> json = params.toJson();

      expect(json['clientUuid'], 'f1e2d3c4');
      expect(json['type'], 'COMPANY_TO_BRANCH');
      expect(json['occurredAt'], '2026-09-05T08:30:00.000Z');
      expect(json['toPartyId'], 's1');

      final List<dynamic> items = json['items'] as List<dynamic>;
      expect(
        (items.single as Map<String, dynamic>)['batterySerialScanned'],
        'BT-1',
      );
    });

    test('an adjustment sends only what the receiver actually changed', () {
      const ItemAdjustmentParams untouched = ItemAdjustmentParams(
        transferItemId: 'i1',
      );
      const ItemAdjustmentParams corrected = ItemAdjustmentParams(
        transferItemId: 'i1',
        hasCharger: false,
      );

      expect(untouched.isEmpty, isTrue);
      expect(corrected.isEmpty, isFalse);

      // An absent field means "the sender's declaration stands", which is not
      // the same as re-asserting it.
      expect(corrected.toJson().containsKey('hasBox'), isFalse);
      expect(corrected.toJson()['hasCharger'], isFalse);
    });

    test('a confirm echoes the hash of what the receiver actually read', () {
      const ConfirmTransferParams params = ConfirmTransferParams(
        signature: SignatureParams(
          method: SignatureMethod.drawn,
          signatureMediaId: 'media-1',
        ),
        payloadHash: 'b6f1c0d2',
      );

      final Map<String, dynamic> json = params.toJson();

      expect(json['payloadHash'], 'b6f1c0d2');
      expect(
        (json['signature'] as Map<String, dynamic>)['method'],
        'DRAWN_SIGNATURE',
      );
      expect(json.containsKey('adjustments'), isFalse);
    });

    test('list filters map onto the query the server expects', () {
      const TransfersQueryParams params = TransfersQueryParams(
        scope: TransfersScope.incoming,
        types: <TransferType>[TransferType.companyToBranch],
        statuses: <TransferStatus>[TransferStatus.pending],
        hasViolations: true,
      );

      final Map<String, dynamic> query = params.toQuery();

      expect(query['type'], <String>['COMPANY_TO_BRANCH']);
      expect(query['status'], <String>['PENDING']);
      expect(query['hasViolations'], 'true');

      expect(params.hasFilters, isTrue);
      expect(params.cleared().hasFilters, isFalse);

      // Clearing filters must not drop the tab the user is looking at.
      expect(params.cleared().scope, TransfersScope.incoming);
    });
  });
}
