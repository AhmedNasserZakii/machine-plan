import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/services/sync/sync_api.dart';
import 'package:machinery/core/services/sync/sync_operation_type.dart';

void main() {
  group('SyncApi.parsePull', () {
    test('parses a full bootstrap-shaped payload', () {
      final SyncPullResult result = SyncApi.parsePull(<String, dynamic>{
        'serverTime': '2026-09-08T12:00:00.000Z',
        'schemaVersion': 3,
        'lookups': <String, dynamic>{
          'machineTypes': <dynamic>[
            <String, dynamic>{'id': 't1', 'name': 'POS'},
          ],
          'branches': <dynamic>[
            <String, dynamic>{'id': 'b1', 'code': 'ALX', 'name': 'Alex'},
          ],
        },
        'myMachines': <dynamic>[
          <String, dynamic>{'id': 'm1', 'serial': 'SN-1'},
        ],
        'myMerchants': <dynamic>[
          <String, dynamic>{'id': 'me1', 'name': 'Shop'},
        ],
        'pendingTransfers': <dynamic>[
          <String, dynamic>{'id': 'tr1', 'status': 'PENDING_RECEIVER'},
        ],
        'permissions': <dynamic>['transfers.create', 'merchants.read'],
      });

      expect(result.schemaVersion, 3);
      expect(result.serverTime, '2026-09-08T12:00:00.000Z');
      expect(result.lookups[SyncLookupCategory.machineTypes]!.single['id'], 't1');
      expect(result.branches.single['code'], 'ALX');
      // A category absent from the payload must not crash the parse — it
      // simply comes back empty, the same as a lookup nobody has rows for yet.
      expect(result.lookups[SyncLookupCategory.violationTypes], isEmpty);
      expect(result.myMachines.single['serial'], 'SN-1');
      expect(result.myMerchants.single['name'], 'Shop');
      expect(result.pendingTransfers.single['id'], 'tr1');
      expect(result.permissions, <String>['transfers.create', 'merchants.read']);
      expect(result.nextSince, isNull);
      expect(result.deletedMachineIds, isEmpty);
    });

    test('parses a delta payload including deletions and nextSince', () {
      final SyncPullResult result = SyncApi.parsePull(<String, dynamic>{
        'serverTime': '2026-09-08T13:00:00.000Z',
        'schemaVersion': 3,
        'lookups': <String, dynamic>{},
        'myMachines': <dynamic>[],
        'myMerchants': <dynamic>[],
        'pendingTransfers': <dynamic>[],
        'permissions': <dynamic>[],
        'deleted': <String, dynamic>{
          'machines': <dynamic>['m-old'],
          'merchants': <dynamic>[],
          'transfers': <dynamic>['tr-old-1', 'tr-old-2'],
        },
        'nextSince': '2026-09-08T13:00:00.000Z',
      });

      expect(result.deletedMachineIds, <String>['m-old']);
      expect(result.deletedMerchantIds, isEmpty);
      expect(result.deletedTransferIds, <String>['tr-old-1', 'tr-old-2']);
      expect(result.nextSince, '2026-09-08T13:00:00.000Z');
    });

    test('a malformed payload degrades to empty collections rather than throwing', () {
      final SyncPullResult result = SyncApi.parsePull(<String, dynamic>{
        'lookups': 'not-a-map',
        'myMachines': 'not-a-list',
      });

      expect(result.lookups[SyncLookupCategory.machineTypes], isEmpty);
      expect(result.myMachines, isEmpty);
      expect(result.schemaVersion, 0);
    });
  });

  group('SyncBatchItemResult.fromJson', () {
    test('parses a SUCCESS result', () {
      final SyncBatchItemResult result = SyncBatchItemResult.fromJson(<String, dynamic>{
        'clientUuid': 'op-1',
        'type': 'CREATE_TRANSFER',
        'status': 'SUCCESS',
        'serverId': 'transfer-server-id',
      });

      expect(result.status, SyncBatchOutcome.success);
      expect(result.type, SyncOperationType.createTransfer);
      expect(result.serverId, 'transfer-server-id');
      expect(result.resolution, isNull);
    });

    test('parses a CONFLICT result carrying serverState and a MANUAL resolution', () {
      final SyncBatchItemResult result = SyncBatchItemResult.fromJson(<String, dynamic>{
        'clientUuid': 'op-2',
        'type': 'CONFIRM_TRANSFER',
        'status': 'CONFLICT',
        'serverId': null,
        'error': <String, dynamic>{
          'code': 'NOT_IN_YOUR_CUSTODY',
          'message': 'الماكينة اتنقلت لحد تاني',
        },
        'resolution': 'MANUAL',
        'serverState': <String, dynamic>{
          'transfer': <String, dynamic>{'id': 'tr-1', 'status': 'CANCELLED'},
        },
      });

      expect(result.status, SyncBatchOutcome.conflict);
      expect(result.resolution, SyncResolution.manual);
      expect(result.errorCode, 'NOT_IN_YOUR_CUSTODY');
      expect(result.serverState?['transfer'], isA<Map<String, dynamic>>());
    });

    test('an unrecognized status falls back to failed rather than throwing', () {
      final SyncBatchItemResult result = SyncBatchItemResult.fromJson(<String, dynamic>{
        'clientUuid': 'op-3',
        'type': 'CREATE_MERCHANT',
        'status': 'SOMETHING_NEW',
      });

      expect(result.status, SyncBatchOutcome.failed);
    });
  });
}
