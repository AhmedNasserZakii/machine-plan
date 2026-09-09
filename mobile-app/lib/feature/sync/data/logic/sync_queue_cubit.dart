import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/services/sync/pending_media_item.dart';
import 'package:machinery/core/services/sync/sync_coordinator.dart';
import 'package:machinery/core/services/sync/sync_queue_item.dart';
import 'package:machinery/core/services/sync/sync_queue_service.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/sync/data/logic/sync_queue_state.dart';

/// Backs `/settings/sync` (`07`): the real, user-facing list of every
/// operation still waiting on the server, not a debug screen.
class SyncQueueCubit extends Cubit<SyncQueueState> {
  SyncQueueCubit({
    required this.syncQueueService,
    required this.syncCoordinator,
    required this.networkInfo,
  }) : super(const SyncQueueState()) {
    _changesSubscription = syncCoordinator.onChange.listen((_) => _reload());
  }

  final SyncQueueService syncQueueService;
  final SyncCoordinator syncCoordinator;
  final NetworkInfo networkInfo;

  StreamSubscription<void>? _changesSubscription;

  Future<void> load() => _reload(showSpinner: true);

  /// Pull-to-refresh: the plan's "manual escape hatch" trigger (`07`).
  Future<void> refresh() async {
    emit(state.copyWith(isRefreshing: true));
    await syncCoordinator.flush();
    await _reload();
    if (!isClosed) emit(state.copyWith(isRefreshing: false));
  }

  Future<void> retryNow(String clientUuid) async {
    await syncQueueService.retryNow(clientUuid);
    if (await networkInfo.isConnected) unawaited(syncCoordinator.flush());
    await _reload();
  }

  Future<void> delete(String clientUuid) async {
    await syncQueueService.delete(clientUuid);
    await _reload();
  }

  Future<void> _reload({bool showSpinner = false}) async {
    if (showSpinner && !isClosed) emit(state.copyWith(isLoading: true));

    final List<SyncQueueItem> items = await syncQueueService.all();
    final List<SyncQueueDisplayItem> display = <SyncQueueDisplayItem>[];

    for (final SyncQueueItem item in items) {
      bool blocked = false;
      if (item.status == SyncItemStatus.pending && item.dependsOn.isNotEmpty) {
        final List<PendingMediaItem> media =
            await syncQueueService.pendingMediaDao.findByClientUuids(item.dependsOn);
        blocked = media.length != item.dependsOn.length ||
            media.any((PendingMediaItem m) => m.uploadState != MediaUploadState.uploaded);
      }
      display.add(SyncQueueDisplayItem(item: item, isBlockedOnMedia: blocked));
    }

    // Newest first — the item someone just created offline is the one they
    // are looking for.
    display.sort((a, b) => b.item.createdAt.compareTo(a.item.createdAt));

    if (!isClosed) emit(state.copyWith(items: display, isLoading: false));
  }

  @override
  Future<void> close() {
    _changesSubscription?.cancel();
    return super.close();
  }
}
