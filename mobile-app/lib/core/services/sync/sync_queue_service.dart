import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/local_db/daos/cached_merchants_dao.dart';
import 'package:machinery/core/local_db/daos/cached_transfers_dao.dart';
import 'package:machinery/core/local_db/daos/pending_media_dao.dart';
import 'package:machinery/core/local_db/daos/sync_queue_dao.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/core/services/sync/media_staging_service.dart';
import 'package:machinery/core/services/sync/pending_media_item.dart';
import 'package:machinery/core/services/sync/pending_sync_counter.dart';
import 'package:machinery/core/services/sync/sync_api.dart';
import 'package:machinery/core/services/sync/sync_operation_type.dart';
import 'package:machinery/core/services/sync/sync_queue_item.dart';
import 'package:machinery/core/utils/enums.dart';

/// Batches never carry more than this many operations (`SyncBatchDto`,
/// backend: `@ArrayMaxSize(50)`).
const int _maxBatchSize = 50;

/// `attemptCount` (after the failed attempt that produced it) → how long to
/// wait before the item is eligible again (`07`, "Backoff").
const List<Duration> _backoffSchedule = <Duration>[
  Duration(minutes: 1),
  Duration(minutes: 5),
  Duration(minutes: 15),
  Duration(hours: 1),
  Duration(hours: 6),
];

/// After this many failed attempts on an otherwise-retryable error, stop
/// retrying automatically and surface it instead (`07`).
const int _maxAutoRetries = 10;

/// The durable FIFO of offline writes (`07`, "The operation queue") for the
/// three operation types this app can create without a connection:
/// `CREATE_TRANSFER`, `CONFIRM_TRANSFER`, `CREATE_MERCHANT`.
///
/// `CREATE_FINANCE_TRANSACTION` keeps its own pre-existing queue
/// (`FinanceSyncQueue`) — see `IMPLEMENTATION_TODO.md` 6.4 for why the two are
/// deliberately not merged. `PendingSyncCounter` is a composite over both
/// (`CompositePendingSyncCounter`), so nothing observing "how much is
/// unsent" has to know two queues exist.
class SyncQueueService implements PendingSyncCounter {
  SyncQueueService({
    required this.queueDao,
    required this.pendingMediaDao,
    required this.mediaStaging,
    required this.syncApi,
    required this.networkInfo,
    required this.cachedMerchantsDao,
    required this.cachedTransfersDao,
  });

  final SyncQueueDao queueDao;
  final PendingMediaDao pendingMediaDao;
  final MediaStagingService mediaStaging;
  final SyncApi syncApi;
  final NetworkInfo networkInfo;
  final CachedMerchantsDao cachedMerchantsDao;
  final CachedTransfersDao cachedTransfersDao;

  bool _pushing = false;

  Future<void> enqueue(SyncQueueItem item) => queueDao.insert(item);

  Future<List<SyncQueueItem>> all() => queueDao.all();

  Future<SyncQueueItem?> findByClientUuid(String clientUuid) =>
      queueDao.findByClientUuid(clientUuid);

  @override
  Future<int> pendingCount() => queueDao.countUnresolved();

  /// Deleting is the only resolution a `conflict`/`failed` item ever gets —
  /// the server already won the argument; there is nothing left to retry.
  /// Any media the operation depended on and nothing else references is
  /// cleaned up with it (`07`, "Clean abandoned local media safely").
  Future<void> delete(String clientUuid) async {
    final SyncQueueItem? item = await queueDao.findByClientUuid(clientUuid);
    await queueDao.delete(clientUuid);

    if (item == null) return;
    for (final String mediaUuid in item.dependsOn) {
      await mediaStaging.deleteStaged(mediaUuid);
    }
  }

  /// Resets a `failed`/`conflict` item back to `pending` with no backoff, for
  /// the sync-queue screen's "retry now" action. A `conflict` retried this
  /// way will simply conflict again unless the user genuinely expects the
  /// server-side blocker to be gone (e.g. they re-registered the merchant) —
  /// the UI is what warns against retrying a conflict blindly, not this call.
  Future<void> retryNow(String clientUuid) async {
    final SyncQueueItem? item = await queueDao.findByClientUuid(clientUuid);
    if (item == null) return;

    await queueDao.update(
      item.copyWith(status: SyncItemStatus.pending, nextRetryAt: DateTime.now(), clearError: true),
    );
  }

  /// Pushes every ready item, in FIFO order, up to `_maxBatchSize` per call —
  /// looping until the queue is drained or nothing more is ready this round
  /// (an item still waiting on a media upload, or still inside its backoff
  /// window, is left for the next flush).
  ///
  /// Never runs two pushes concurrently: `SyncCoordinator` calls this from
  /// several independent triggers (connectivity, resume, manual, timer) that
  /// can legitimately overlap.
  Future<void> pushPending() async {
    if (_pushing) return;
    _pushing = true;

    try {
      if (!await networkInfo.isConnected) return;

      while (true) {
        final List<SyncQueueItem> ready = await _nextReadyBatch();
        if (ready.isEmpty) return;

        await _pushOneBatch(ready);
      }
    } finally {
      _pushing = false;
    }
  }

  Future<List<SyncQueueItem>> _nextReadyBatch() async {
    final DateTime now = DateTime.now();
    final List<SyncQueueItem> candidates = <SyncQueueItem>[];

    for (final SyncQueueItem item in await queueDao.pending()) {
      if (item.nextRetryAt != null && item.nextRetryAt!.isAfter(now)) continue;
      if (!await _dependenciesReady(item)) continue;

      candidates.add(item);
      if (candidates.length >= _maxBatchSize) break;
    }

    return candidates;
  }

  Future<bool> _dependenciesReady(SyncQueueItem item) async {
    if (item.dependsOn.isNotEmpty) {
      final List<PendingMediaItem> media = await pendingMediaDao.findByClientUuids(item.dependsOn);
      if (media.length != item.dependsOn.length) return false;
      if (!media.every((PendingMediaItem row) => row.uploadState == MediaUploadState.uploaded)) {
        return false;
      }
    }

    return _referencedMerchantReady(item);
  }

  /// A `CREATE_TRANSFER`/`CREATE_SUBSCRIPTION` queued against a merchant that
  /// was itself registered offline moments earlier names it by that
  /// still-unresolved id — nothing distinguishes it from a real one on this
  /// device, since an offline `createMerchant()` hands back the very
  /// `clientUuid` it queued under. `dependsOn` cannot express this (it is
  /// media-shaped: a list of upload ids, checked against `pending_media`),
  /// so this reads the referenced id straight out of the operation's own
  /// payload instead — no separate bookkeeping to keep in sync with it.
  ///
  /// Ready as soon as that id is no longer sitting in this same queue: gone
  /// means either it was never a local id at all, or it resolved and its
  /// `CREATE_MERCHANT` item was deleted (`_applyResult`, `SUCCESS`/`DUPLICATE`).
  /// This is what stops a merchant's own item sitting in backoff from letting
  /// a freshly-queued dependent transfer jump ahead of it in the same push —
  /// FIFO order alone does not guarantee that once one of the two has failed
  /// and is retrying on its own schedule.
  Future<bool> _referencedMerchantReady(SyncQueueItem item) async {
    final String? merchantId = switch (item.type) {
      SyncOperationType.createTransfer =>
        item.payload[ApiKeys.toPartyId] as String?,
      SyncOperationType.createSubscription =>
        item.payload[ApiKeys.merchantId] as String?,
      _ => null,
    };

    if (merchantId == null) return true;
    return await queueDao.findByClientUuid(merchantId) == null;
  }

  Future<void> _pushOneBatch(List<SyncQueueItem> items) async {
    for (final SyncQueueItem item in items) {
      await queueDao.update(item.copyWith(status: SyncItemStatus.inFlight));
    }

    final List<Map<String, dynamic>> operations = items
        .map(
          (SyncQueueItem item) => <String, dynamic>{
            'clientUuid': item.clientUuid,
            'type': item.type.value,
            'payload': item.payload,
            if (item.occurredAt != null)
              'occurredAt': item.occurredAt!.toUtc().toIso8601String(),
          },
        )
        .toList(growable: false);

    late final List<SyncBatchItemResult> results;
    try {
      results = await syncApi.pushBatch(operations);
    } catch (error, stackTrace) {
      printDebug(message: 'sync batch push failed: $error', stackTrace: stackTrace);
      // A transport failure (offline mid-push, 5xx, timeout) answers nothing
      // about any individual item — they all just go back to `pending` for
      // the next flush, with no attempt charged against them.
      for (final SyncQueueItem item in items) {
        await queueDao.update(item.copyWith(status: SyncItemStatus.pending));
      }
      return;
    }

    final Map<String, SyncBatchItemResult> byUuid = <String, SyncBatchItemResult>{
      for (final SyncBatchItemResult result in results) result.clientUuid: result,
    };

    for (final SyncQueueItem item in items) {
      final SyncBatchItemResult? result = byUuid[item.clientUuid];
      if (result == null) {
        // The server answered with fewer results than operations sent — a
        // contract violation, but the honest local action is still "try
        // again later", not silently losing the item.
        await queueDao.update(item.copyWith(status: SyncItemStatus.pending));
        continue;
      }
      await _applyResult(item, result);
    }
  }

  Future<void> _applyResult(SyncQueueItem item, SyncBatchItemResult result) async {
    switch (result.status) {
      case SyncBatchOutcome.success:
      case SyncBatchOutcome.duplicate:
        // The row it became will arrive on the delta pull `SyncCoordinator`
        // runs right after this push — but that pull upserts by the
        // server's own id, a different primary key from the client-generated
        // `clientUuid` this item's optimistic row was stored under (verified
        // live: a synced merchant otherwise leaves both rows behind as a
        // permanent duplicate in the list). So the optimistic row for the two
        // operation types that create one is dropped explicitly here, not
        // "overwritten" — `CONFIRM_TRANSFER`/`CREATE_FINANCE_TRANSACTION`
        // never created a client-uuid-keyed row, so there is nothing to do
        // for them.
        switch (item.type) {
          case SyncOperationType.createMerchant:
            await cachedMerchantsDao.deleteByIds(<String>[item.clientUuid]);
          case SyncOperationType.createTransfer:
            await cachedTransfersDao.deleteByIds(<String>[item.clientUuid]);
          case SyncOperationType.confirmTransfer:
          case SyncOperationType.rejectTransfer:
          case SyncOperationType.createSubscription:
          case SyncOperationType.createFinanceTransaction:
            break;
        }
        await queueDao.delete(item.clientUuid);

      case SyncBatchOutcome.conflict:
        await queueDao.update(
          item.copyWith(
            status: SyncItemStatus.conflict,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
            serverState: result.serverState ?? const <String, dynamic>{},
          ),
        );

      case SyncBatchOutcome.failed:
        if (result.resolution == SyncResolution.retry) {
          final int attempts = item.attemptCount + 1;
          if (attempts >= _maxAutoRetries) {
            await queueDao.update(
              item.copyWith(
                status: SyncItemStatus.failed,
                attemptCount: attempts,
                errorCode: result.errorCode,
                errorMessage: result.errorMessage,
              ),
            );
          } else {
            await queueDao.update(
              item.copyWith(
                status: SyncItemStatus.pending,
                attemptCount: attempts,
                lastAttemptAt: DateTime.now(),
                nextRetryAt: DateTime.now().add(_backoffFor(attempts)),
                errorCode: result.errorCode,
                errorMessage: result.errorMessage,
              ),
            );
          }
        } else {
          // DISCARD, or no resolution given at all: nothing further to try.
          await queueDao.update(
            item.copyWith(
              status: SyncItemStatus.failed,
              attemptCount: item.attemptCount + 1,
              errorCode: result.errorCode,
              errorMessage: result.errorMessage,
            ),
          );
        }
    }
  }

  Duration _backoffFor(int attemptCount) {
    final int index = (attemptCount - 1).clamp(0, _backoffSchedule.length - 1);
    return _backoffSchedule[index];
  }
}

/// Sums two independent queues into the one number the logout warning and
/// any future app-bar badge actually need. `finance` and `operations` are
/// never merged into one table (see `SyncQueueService` doc) but a
/// representative does not care which mechanism is holding his work.
class CompositePendingSyncCounter implements PendingSyncCounter {
  const CompositePendingSyncCounter({required this.counters});

  final List<PendingSyncCounter> counters;

  @override
  Future<int> pendingCount() async {
    int total = 0;
    for (final PendingSyncCounter counter in counters) {
      total += await counter.pendingCount();
    }
    return total;
  }
}
