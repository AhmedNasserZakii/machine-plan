import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/local_db/app_database.dart';
import 'package:machinery/core/local_db/daos/cached_machines_dao.dart';
import 'package:machinery/core/local_db/daos/pending_media_dao.dart';
import 'package:machinery/core/local_db/daos/sync_queue_dao.dart';
import 'package:machinery/core/services/sync/pending_media_item.dart';
import 'package:machinery/core/services/sync/sync_operation_type.dart';
import 'package:machinery/core/services/sync/sync_queue_item.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

Map<String, dynamic> _machineJson(String id, {String serial = 'SN-001'}) => <String, dynamic>{
  'id': id,
  'serial': serial,
  'status': 'WITH_REPRESENTATIVE',
  'hasBox': true,
  'type': <String, dynamic>{'id': 't1', 'name': 'POS', 'requiresSim': true},
  'model': <String, dynamic>{'id': 'm1', 'name': 'Model X'},
  'holder': <String, dynamic>{'type': 'USER', 'id': 'user-1'},
  'warranty': <String, dynamic>{'isActive': true, 'daysRemaining': 10},
};

void main() {
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  late String dbPath;

  setUp(() async {
    final Directory tempDir = await Directory.systemTemp.createTemp('machinery_db_test');
    dbPath = p.join(tempDir.path, 'test.db');
  });

  tearDown(() async {
    final File file = File(dbPath);
    if (file.existsSync()) file.deleteSync();
  });

  group('AppDatabase schema', () {
    test('onCreate at the current version builds every table and index', () async {
      final AppDatabase db = await AppDatabase.open(path: dbPath);

      final List<Map<String, dynamic>> tables = await db.db.rawQuery(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      );
      final List<String> names = tables.map((row) => row['name'] as String).toList();

      expect(
        names,
        containsAll(<String>[
          'cached_machines',
          'cached_merchants',
          'cached_branches',
          'cached_lookups',
          'cached_transfers',
          'sync_queue',
          'pending_media',
        ]),
      );

      final List<Map<String, dynamic>> indexes = await db.db.rawQuery(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL",
      );
      expect(
        indexes.map((row) => row['name']),
        containsAll(<String>[
          'idx_cached_machines_serial',
          'idx_cached_machines_holder',
          'idx_sync_queue_order',
          'idx_pending_media_state',
        ]),
      );

      await db.close();
    });

    test('onUpgrade from v1 to v2 adds the queue tables without losing v1 data', () async {
      // Open at v1: only the cached reference tables exist yet.
      final AppDatabase v1 = await AppDatabase.open(path: dbPath, version: 1);
      final CachedMachinesDao machinesDao = CachedMachinesDao(v1);
      await machinesDao.upsertAll(<Map<String, dynamic>>[_machineJson('m-1')]);

      final List<Map<String, dynamic>> v1Tables = await v1.db.rawQuery(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      );
      expect(v1Tables.map((row) => row['name']), isNot(contains('sync_queue')));
      await v1.close();

      // Reopen at v2: onUpgrade must run, add the new tables, and the v1 row
      // must have survived the migration untouched.
      final AppDatabase v2 = await AppDatabase.open(path: dbPath, version: 2);

      final List<Map<String, dynamic>> v2Tables = await v2.db.rawQuery(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      );
      expect(v2Tables.map((row) => row['name']), contains('sync_queue'));
      expect(v2Tables.map((row) => row['name']), contains('pending_media'));

      final CachedMachinesDao machinesDaoV2 = CachedMachinesDao(v2);
      final machine = await machinesDaoV2.findById('m-1');
      expect(machine, isNotNull);
      expect(machine!.serial, 'SN-001');

      await v2.close();
    });
  });

  group('CachedMachinesDao', () {
    test('upsert, find by holder, search, delete and clear round-trip', () async {
      final AppDatabase db = await AppDatabase.open(path: dbPath);
      final CachedMachinesDao dao = CachedMachinesDao(db);

      await dao.upsertAll(<Map<String, dynamic>>[
        _machineJson('m-1', serial: 'SN-100'),
        _machineJson('m-2', serial: 'SN-200'),
      ]);

      expect((await dao.all()).length, 2);
      expect((await dao.findById('m-1'))?.serial, 'SN-100');
      expect((await dao.findByHolder(holderType: 'USER', holderId: 'user-1')).length, 2);
      expect((await dao.search(query: 'SN-200')).single.id, 'm-2');

      await dao.deleteByIds(<String>['m-1']);
      expect((await dao.all()).length, 1);

      await dao.clear();
      expect(await dao.all(), isEmpty);

      await db.close();
    });
  });

  group('SyncQueueDao', () {
    test('insert, update status, and ordered pending() round-trip', () async {
      final AppDatabase db = await AppDatabase.open(path: dbPath);
      final SyncQueueDao dao = SyncQueueDao(db);

      final SyncQueueItem item = SyncQueueItem(
        clientUuid: 'op-1',
        type: SyncOperationType.createMerchant,
        payload: <String, dynamic>{'name': 'Test Shop'},
        createdAt: DateTime.utc(2026, 1, 1),
        status: SyncItemStatus.pending,
        priority: 1,
      );
      await dao.insert(item);

      expect((await dao.pending()).single.clientUuid, 'op-1');
      expect(await dao.countUnresolved(), 1);

      final SyncQueueItem retrieved = (await dao.findByClientUuid('op-1'))!;
      expect(retrieved.payload['name'], 'Test Shop');

      await dao.update(retrieved.copyWith(status: SyncItemStatus.conflict, errorCode: 'X'));
      expect((await dao.byStatus(SyncItemStatus.conflict)).single.errorCode, 'X');
      // A conflict still counts as unresolved — it needs a person's decision.
      expect(await dao.countUnresolved(), 1);

      await dao.update((await dao.findByClientUuid('op-1'))!.copyWith(status: SyncItemStatus.synced));
      expect(await dao.countUnresolved(), 0);

      await dao.delete('op-1');
      expect(await dao.all(), isEmpty);

      await db.close();
    });
  });

  group('PendingMediaDao', () {
    test('insert, update upload state, and lookup by clientUuids round-trip', () async {
      final AppDatabase db = await AppDatabase.open(path: dbPath);
      final PendingMediaDao dao = PendingMediaDao(db);

      final PendingMediaItem item = PendingMediaItem(
        clientUuid: 'media-1',
        localPath: '/tmp/photo.jpg',
        purpose: 'TRANSFER_PHOTO',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        checksum: 'abc123',
        createdAt: DateTime.utc(2026, 1, 1),
        uploadState: MediaUploadState.staged,
      );
      await dao.insert(item);

      expect((await dao.notUploaded()).single.clientUuid, 'media-1');

      await dao.update(item.copyWith(uploadState: MediaUploadState.uploaded, serverMediaId: 'srv-1'));
      expect(await dao.notUploaded(), isEmpty);

      final PendingMediaItem uploaded = (await dao.findByClientUuids(<String>['media-1'])).single;
      expect(uploaded.serverMediaId, 'srv-1');

      await dao.clear();
      expect(await dao.all(), isEmpty);

      await db.close();
    });
  });
}
