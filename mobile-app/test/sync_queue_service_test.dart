import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/local_db/app_database.dart';
import 'package:machinery/core/local_db/daos/cached_merchants_dao.dart';
import 'package:machinery/core/local_db/daos/cached_transfers_dao.dart';
import 'package:machinery/core/local_db/daos/pending_media_dao.dart';
import 'package:machinery/core/local_db/daos/sync_queue_dao.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/services/sync/media_staging_service.dart';
import 'package:machinery/core/services/sync/pending_media_item.dart';
import 'package:machinery/core/services/sync/pending_sync_counter.dart';
import 'package:machinery/core/services/sync/sync_api.dart';
import 'package:machinery/core/services/sync/sync_operation_type.dart';
import 'package:machinery/core/services/sync/sync_queue_item.dart';
import 'package:machinery/core/services/sync/sync_queue_service.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

class _FakeNetworkInfo implements NetworkInfo {
  bool connected = true;

  @override
  Future<bool> get isConnected async => connected;
}

/// Overrides the one network call `SyncQueueService` makes, so the test drives
/// the queue's own logic (backoff, conflict handling, dependency gating)
/// against canned server answers rather than a real HTTP round trip — the
/// same "subclass and override" seam the codebase otherwise has no mocking
/// library for.
class _ScriptedSyncApi extends SyncApi {
  _ScriptedSyncApi.withScript(this.script) : super(apiService: ApiService());

  final List<SyncBatchItemResult> Function(List<Map<String, dynamic>> operations) script;

  @override
  Future<List<SyncBatchItemResult>> pushBatch(List<Map<String, dynamic>> operations) async {
    return script(operations);
  }
}

SyncQueueItem _item(
  String uuid, {
  SyncOperationType type = SyncOperationType.createMerchant,
  List<String> dependsOn = const <String>[],
}) {
  return SyncQueueItem(
    clientUuid: uuid,
    type: type,
    payload: <String, dynamic>{'name': 'Shop $uuid'},
    createdAt: DateTime.now().toUtc(),
    status: SyncItemStatus.pending,
    dependsOn: dependsOn,
  );
}

void main() {
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  late AppDatabase db;
  late SyncQueueDao queueDao;
  late PendingMediaDao mediaDao;
  late CachedMerchantsDao merchantsDao;
  late CachedTransfersDao transfersDao;
  late _FakeNetworkInfo networkInfo;
  late String dbPath;

  setUp(() async {
    final Directory tempDir = await Directory.systemTemp.createTemp('sync_queue_test');
    dbPath = p.join(tempDir.path, 'test.db');
    db = await AppDatabase.open(path: dbPath);
    queueDao = SyncQueueDao(db);
    mediaDao = PendingMediaDao(db);
    merchantsDao = CachedMerchantsDao(db);
    transfersDao = CachedTransfersDao(db);
    networkInfo = _FakeNetworkInfo();
  });

  tearDown(() async {
    await db.close();
    final File file = File(dbPath);
    if (file.existsSync()) file.deleteSync();
  });

  SyncQueueService buildService(
    List<SyncBatchItemResult> Function(List<Map<String, dynamic>> operations) script,
  ) {
    return SyncQueueService(
      queueDao: queueDao,
      pendingMediaDao: mediaDao,
      mediaStaging: MediaStagingService(
        pendingMediaDao: mediaDao,
        apiService: ApiService(),
        networkInfo: networkInfo,
      ),
      syncApi: _ScriptedSyncApi.withScript(script),
      networkInfo: networkInfo,
      cachedMerchantsDao: merchantsDao,
      cachedTransfersDao: transfersDao,
    );
  }

  test('a SUCCESS result removes the item from the queue entirely', () async {
    final SyncQueueService service = buildService(
      (ops) => <SyncBatchItemResult>[
        SyncBatchItemResult(
          clientUuid: ops.single['clientUuid'] as String,
          type: SyncOperationType.createMerchant,
          status: SyncBatchOutcome.success,
          serverId: 'server-1',
        ),
      ],
    );

    await service.enqueue(_item('op-1'));
    await service.pushPending();

    expect(await service.findByClientUuid('op-1'), isNull);
    expect(await service.pendingCount(), 0);
  });

  test('a SUCCESS on CREATE_MERCHANT drops the optimistic cache row, not just the queue item', () async {
    // Reproduces a bug caught live on an emulator: the optimistic row is
    // stored under the client-generated `clientUuid` as its id, but the
    // delta/bootstrap pull that follows a successful push upserts by the
    // *server's* id — a different primary key — so without this cleanup the
    // merchant is left in the cache twice (once under each id) forever.
    await merchantsDao.upsertOne(<String, dynamic>{
      'id': 'op-1',
      'name': 'Optimistic Merchant',
      'phone': '0100000000',
      'shopName': 'Shop',
    });

    final SyncQueueService service = buildService(
      (ops) => <SyncBatchItemResult>[
        SyncBatchItemResult(
          clientUuid: ops.single['clientUuid'] as String,
          type: SyncOperationType.createMerchant,
          status: SyncBatchOutcome.success,
          serverId: 'server-1',
        ),
      ],
    );

    await service.enqueue(_item('op-1'));
    await service.pushPending();

    expect(await merchantsDao.findById('op-1'), isNull);
  });

  test('a DUPLICATE result also clears the item — it already landed', () async {
    final SyncQueueService service = buildService(
      (ops) => <SyncBatchItemResult>[
        SyncBatchItemResult(
          clientUuid: ops.single['clientUuid'] as String,
          type: SyncOperationType.createMerchant,
          status: SyncBatchOutcome.duplicate,
          serverId: 'server-1',
        ),
      ],
    );

    await service.enqueue(_item('op-1'));
    await service.pushPending();

    expect(await service.findByClientUuid('op-1'), isNull);
  });

  test('a CONFLICT result is kept, marked conflict, and carries serverState — never silently dropped', () async {
    final SyncQueueService service = buildService(
      (ops) => <SyncBatchItemResult>[
        SyncBatchItemResult(
          clientUuid: ops.single['clientUuid'] as String,
          type: SyncOperationType.confirmTransfer,
          status: SyncBatchOutcome.conflict,
          errorCode: 'NOT_IN_YOUR_CUSTODY',
          errorMessage: 'الماكينة اتنقلت',
          resolution: SyncResolution.manual,
          serverState: <String, dynamic>{
            'transfer': <String, dynamic>{'status': 'CANCELLED'},
          },
        ),
      ],
    );

    await service.enqueue(_item('op-1', type: SyncOperationType.confirmTransfer));
    await service.pushPending();

    final SyncQueueItem? item = await service.findByClientUuid('op-1');
    expect(item, isNotNull);
    expect(item!.status, SyncItemStatus.conflict);
    expect(item.serverState?['transfer'], isNotNull);
    // A conflict still counts as unresolved work for the logout warning.
    expect(await service.pendingCount(), 1);
  });

  test('a FAILED+DISCARD result marks the item permanently failed on the first try', () async {
    final SyncQueueService service = buildService(
      (ops) => <SyncBatchItemResult>[
        SyncBatchItemResult(
          clientUuid: ops.single['clientUuid'] as String,
          type: SyncOperationType.createMerchant,
          status: SyncBatchOutcome.failed,
          resolution: SyncResolution.discard,
          errorCode: 'VALIDATION_FAILED',
        ),
      ],
    );

    await service.enqueue(_item('op-1'));
    await service.pushPending();

    final SyncQueueItem? item = await service.findByClientUuid('op-1');
    expect(item!.status, SyncItemStatus.failed);
    expect(item.attemptCount, 1);
  });

  test('a FAILED+RETRY result schedules backoff and is not re-sent before it elapses', () async {
    int calls = 0;
    final SyncQueueService service = buildService((ops) {
      calls++;
      return <SyncBatchItemResult>[
        SyncBatchItemResult(
          clientUuid: ops.single['clientUuid'] as String,
          type: SyncOperationType.createMerchant,
          status: SyncBatchOutcome.failed,
          resolution: SyncResolution.retry,
          errorCode: 'MEDIA_NOT_FOUND',
        ),
      ];
    });

    await service.enqueue(_item('op-1'));
    await service.pushPending();
    expect(calls, 1);

    final SyncQueueItem afterFirst = (await service.findByClientUuid('op-1'))!;
    expect(afterFirst.status, SyncItemStatus.pending);
    expect(afterFirst.attemptCount, 1);
    expect(afterFirst.nextRetryAt!.isAfter(DateTime.now()), isTrue);

    // The backoff window has not elapsed — a second flush must not re-push it.
    await service.pushPending();
    expect(calls, 1);
  });

  test('after the max auto-retries a RETRY result gives up and marks the item failed', () async {
    final SyncQueueService service = buildService(
      (ops) => <SyncBatchItemResult>[
        SyncBatchItemResult(
          clientUuid: ops.single['clientUuid'] as String,
          type: SyncOperationType.createMerchant,
          status: SyncBatchOutcome.failed,
          resolution: SyncResolution.retry,
        ),
      ],
    );

    // Seed the item already nine attempts in, due right now — the tenth
    // failure must stop the automatic retry loop rather than continue it
    // forever.
    await queueDao.insert(
      _item('op-1').copyWith(attemptCount: 9, nextRetryAt: DateTime.now().subtract(const Duration(seconds: 1))),
    );

    await service.pushPending();

    final SyncQueueItem? item = await service.findByClientUuid('op-1');
    expect(item!.status, SyncItemStatus.failed);
    expect(item.attemptCount, 10);
  });

  test('an item depending on an unfinished media upload is not pushed yet', () async {
    int calls = 0;
    final SyncQueueService service = buildService((ops) {
      calls++;
      return ops
          .map(
            (op) => SyncBatchItemResult(
              clientUuid: op['clientUuid'] as String,
              type: SyncOperationType.createTransfer,
              status: SyncBatchOutcome.success,
              serverId: 'server-1',
            ),
          )
          .toList();
    });

    await mediaDao.insert(
      PendingMediaItem(
        clientUuid: 'media-1',
        localPath: '/tmp/x.jpg',
        purpose: 'TRANSFER_PHOTO',
        mimeType: 'image/jpeg',
        sizeBytes: 10,
        checksum: 'x',
        createdAt: DateTime.now().toUtc(),
        uploadState: MediaUploadState.staged,
      ),
    );
    await service.enqueue(
      _item('op-1', type: SyncOperationType.createTransfer, dependsOn: <String>['media-1']),
    );

    await service.pushPending();
    expect(calls, 0, reason: 'the operation must wait for its photo to finish uploading first');
    expect((await service.findByClientUuid('op-1'))!.status, SyncItemStatus.pending);

    await mediaDao.update(
      (await mediaDao.findByClientUuid('media-1'))!
          .copyWith(uploadState: MediaUploadState.uploaded, serverMediaId: 'srv-media-1'),
    );

    await service.pushPending();
    expect(calls, 1);
    expect(await service.findByClientUuid('op-1'), isNull);
  });

  test('deleting a queue item also cleans up any media it depended on', () async {
    final SyncQueueService service = buildService((ops) => <SyncBatchItemResult>[]);

    final Directory tempMediaDir = await Directory.systemTemp.createTemp('media_test');
    final File stagedFile = File(p.join(tempMediaDir.path, 'photo.jpg'));
    await stagedFile.writeAsBytes(<int>[1, 2, 3]);

    await mediaDao.insert(
      PendingMediaItem(
        clientUuid: 'media-1',
        localPath: stagedFile.path,
        purpose: 'TRANSFER_PHOTO',
        mimeType: 'image/jpeg',
        sizeBytes: 3,
        checksum: 'x',
        createdAt: DateTime.now().toUtc(),
        uploadState: MediaUploadState.staged,
      ),
    );
    await service.enqueue(_item('op-1', dependsOn: <String>['media-1']));

    await service.delete('op-1');

    expect(await service.findByClientUuid('op-1'), isNull);
    expect(await mediaDao.findByClientUuid('media-1'), isNull);
    expect(stagedFile.existsSync(), isFalse);

    await tempMediaDir.delete(recursive: true);
  });

  test('CompositePendingSyncCounter sums every underlying counter', () async {
    final SyncQueueService service = buildService((ops) => <SyncBatchItemResult>[]);
    await service.enqueue(_item('op-1'));
    await service.enqueue(_item('op-2'));

    final CompositePendingSyncCounter composite = CompositePendingSyncCounter(
      counters: <PendingSyncCounter>[service, const _FixedCounter(3)],
    );

    expect(await composite.pendingCount(), 5);
  });
}

class _FixedCounter implements PendingSyncCounter {
  const _FixedCounter(this.count);
  final int count;

  @override
  Future<int> pendingCount() async => count;
}
