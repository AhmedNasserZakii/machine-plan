import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:machinery/core/connection/network_connection_status.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/local_db/daos/cached_branches_dao.dart';
import 'package:machinery/core/local_db/daos/cached_lookups_dao.dart';
import 'package:machinery/core/local_db/daos/cached_machines_dao.dart';
import 'package:machinery/core/local_db/daos/cached_merchants_dao.dart';
import 'package:machinery/core/local_db/daos/cached_transfers_dao.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/core/services/sync/media_staging_service.dart';
import 'package:machinery/core/services/sync/sync_api.dart';
import 'package:machinery/core/services/sync/sync_queue_service.dart';

/// Orchestrates the whole offline-sync lifecycle (`07`, `SyncService`): which
/// of bootstrap/delta to run, when to run it, and what order a flush drains
/// the local write queue in.
///
/// Nothing outside this class decides *when* to sync — a repository that just
/// wrote something calls [flush] and moves on; whether that flush actually
/// does anything (or is a no-op because one is already running, or the
/// device is offline) is this class's call alone.
class SyncCoordinator {
  SyncCoordinator({
    required this.syncApi,
    required this.syncQueueService,
    required this.mediaStaging,
    required this.networkInfo,
    required this.permissionService,
    required this.cachedMachinesDao,
    required this.cachedMerchantsDao,
    required this.cachedBranchesDao,
    required this.cachedLookupsDao,
    required this.cachedTransfersDao,
  });

  final SyncApi syncApi;
  final SyncQueueService syncQueueService;
  final MediaStagingService mediaStaging;
  final NetworkInfo networkInfo;
  final PermissionService permissionService;
  final CachedMachinesDao cachedMachinesDao;
  final CachedMerchantsDao cachedMerchantsDao;
  final CachedBranchesDao cachedBranchesDao;
  final CachedLookupsDao cachedLookupsDao;
  final CachedTransfersDao cachedTransfersDao;

  bool _flushing = false;
  Timer? _periodicTimer;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  AppLifecycleListener? _lifecycleListener;

  /// A tiny broadcast so the sync-queue screen and any app-bar badge can
  /// repaint the moment a flush changes something, without polling.
  final StreamController<void> _changes = StreamController<void>.broadcast();
  Stream<void> get onChange => _changes.stream;

  /// Fired the instant something local changes — an enqueue, a delete — so a
  /// badge listening for it does not have to wait for the next flush
  /// (`flush` itself only fires this when it actually ran, i.e. while
  /// online; an offline enqueue still needs to update the count on screen
  /// immediately).
  void notifyChange() {
    if (!_changes.isClosed) _changes.add(null);
  }

  /// Wires the triggers a flush does not arrive at on its own: connectivity
  /// restored, and the app coming back to the foreground. Call once, after
  /// the service locator is set up.
  void start() {
    unawaited(mediaStaging.recoverInterruptedUploads());

    _connectivitySubscription =
        Connectivity().onConnectivityChanged.listen((results) {
      final bool online =
          results.any((ConnectivityResult r) => r != ConnectivityResult.none);
      reportNetworkConnectionStatus(online);
      if (online) unawaited(flush());
    });

    _lifecycleListener = AppLifecycleListener(
      onResume: () {
        unawaited(flush());
        _startPeriodicTimer();
      },
      onPause: _periodicTimer?.cancel,
      onHide: _periodicTimer?.cancel,
    );

    _startPeriodicTimer();
  }

  void dispose() {
    _connectivitySubscription?.cancel();
    _lifecycleListener?.dispose();
    _periodicTimer?.cancel();
    _changes.close();
  }

  void _startPeriodicTimer() {
    _periodicTimer?.cancel();
    // `07`: "periodic timer (15 min) while foregrounded — catches flaky
    // connections" a push/pull would not otherwise notice dropped.
    _periodicTimer =
        Timer.periodic(const Duration(minutes: 15), (_) => unawaited(flush()));
  }

  /// The full cycle a trigger asks for: drain staged media, push queued
  /// operations, then pull whatever changed — in that order, because an
  /// operation the push just created should show up as already-synced in the
  /// very same refresh, not one cycle later (`07`, `SyncService.flush()`).
  Future<void> flush() async {
    if (_flushing) return;
    _flushing = true;

    try {
      if (!await networkInfo.isConnected) return;

      // Every trigger this class listens for (app resume, connectivity
      // restored, the periodic timer) fires whether or not anyone is signed
      // in — including at the very first launch, on the login screen. A
      // `/sync/bootstrap` call with no access token would still get a real
      // `401` from the server, which is indistinguishable, to the app's
      // global session-expired handler, from an actual dead session — so
      // this checks for a stored token itself rather than trusting a caller
      // to only ever call `flush` while authenticated.
      if ((await LocalStorage.getAccessToken()).isEmpty) return;

      await mediaStaging.recoverInterruptedUploads();
      await mediaStaging.uploadAllPending();
      await syncQueueService.pushPending();
      await _pullLatest();

      _changes.add(null);
      // Analytics is optional at the call site — avoid importing the funnel
      // into every flush path by keeping success silent; failures are logged.
    } catch (error, stackTrace) {
      printDebug(message: 'sync flush failed: $error', stackTrace: stackTrace);
    } finally {
      _flushing = false;
    }
  }

  Future<void> _pullLatest() async {
    final int? localSchemaVersion = LocalStorage.getSchemaVersion();
    final String cursor = LocalStorage.getLastSyncedAt();

    if (localSchemaVersion == null || cursor.isEmpty) {
      await _runBootstrap();
      return;
    }

    final ({String serverTime, int schemaVersion}) status =
        await syncApi.status();
    if (status.schemaVersion != localSchemaVersion) {
      await _runBootstrap();
      return;
    }

    final SyncPullResult delta = await syncApi.delta(cursor);
    await _applyPull(delta, isBootstrap: false);

    SyncPullResult chunk = delta;
    int safety = 0;
    while (chunk.hasMore &&
        chunk.nextSince != null &&
        chunk.nextSince!.isNotEmpty &&
        safety < 25) {
      chunk = await syncApi.delta(chunk.nextSince!);
      await _applyPull(chunk, isBootstrap: false);
      safety++;
    }
  }

  Future<void> _runBootstrap() async {
    final SyncPullResult result = await syncApi.bootstrap();
    await _applyPull(result, isBootstrap: true);
  }

  Future<void> _applyPull(SyncPullResult result,
      {required bool isBootstrap}) async {
    if (isBootstrap) {
      await cachedBranchesDao.replaceAll(result.branches,
          syncedAt: result.serverTime);
      for (final String category in SyncLookupCategory.all) {
        await cachedLookupsDao.replaceCategory(
            category, result.lookups[category] ?? const []);
      }
    }

    await cachedMachinesDao.upsertAll(result.myMachines,
        syncedAt: result.serverTime);
    await cachedMerchantsDao.upsertAll(result.myMerchants,
        syncedAt: result.serverTime);
    await cachedTransfersDao.upsertAll(result.pendingTransfers,
        syncedAt: result.serverTime);

    if (result.truncatedMyMachines || result.truncatedMyMerchants) {
      printDebug(
        message:
            'sync bootstrap truncated myMachines=${result.truncatedMyMachines} '
            'myMerchants=${result.truncatedMyMerchants}',
      );
    }

    await cachedMachinesDao.deleteByIds(result.deletedMachineIds);
    await cachedMerchantsDao.deleteByIds(result.deletedMerchantIds);
    await cachedTransfersDao.deleteByIds(result.deletedTransferIds);

    // Refreshing this here — not only from `/auth/me` — is what makes a
    // Director's permission change reach a device that is currently offline
    // the moment it next gets a signal, not only on the next explicit login.
    await permissionService.update(result.permissions);

    await LocalStorage.setSchemaVersion(result.schemaVersion);
    // Bootstrap has no `nextSince` of its own — its `serverTime` is exactly
    // that: the server's clock at the moment it built the snapshot, which is
    // the correct starting cursor for the very next delta call.
    await LocalStorage.setLastSyncedAt(result.nextSince ?? result.serverTime);
  }

  /// `LocaleService`'s per-cache invalidator hook (`locale_service.dart`,
  /// "the sync layer adds its own in phase 2"). Every cached name — machine
  /// types, violation types, branches, merchant/machine list rows — was
  /// rendered in the old language, so the honest fix is to drop them and
  /// force a full re-bootstrap rather than leave a mixed-language cache
  /// sitting on screen until the next unrelated sync.
  Future<void> invalidateForLocaleChange() async {
    await cachedLookupsDao.clear();
    await cachedBranchesDao.clear();
    await cachedMachinesDao.clear();
    await cachedMerchantsDao.clear();
    await cachedTransfersDao.clear();
    await LocalStorage.clearSyncCursor();

    if (await networkInfo.isConnected) await flush();
  }
}
