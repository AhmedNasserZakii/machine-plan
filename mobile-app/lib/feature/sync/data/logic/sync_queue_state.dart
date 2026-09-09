import 'package:equatable/equatable.dart';
import 'package:machinery/core/services/sync/sync_queue_item.dart';

/// A queue row plus the one thing the row itself cannot say: whether it is
/// actually blocked on a photo/signature still uploading. `SyncItemStatus`
/// stays a pure server-driven state machine; "blocked" is a display-only
/// distinction computed here from `dependsOn`.
class SyncQueueDisplayItem extends Equatable {
  const SyncQueueDisplayItem({required this.item, required this.isBlockedOnMedia});

  final SyncQueueItem item;

  /// True only while [item] is otherwise `pending` and at least one of its
  /// `dependsOn` media uploads has not finished — the queue processor will
  /// not push it yet regardless of how long it has waited.
  final bool isBlockedOnMedia;

  @override
  List<Object?> get props => <Object?>[item.clientUuid, item.status, isBlockedOnMedia, item.attemptCount];
}

class SyncQueueState extends Equatable {
  const SyncQueueState({
    this.items = const <SyncQueueDisplayItem>[],
    this.isLoading = true,
    this.isRefreshing = false,
  });

  final List<SyncQueueDisplayItem> items;
  final bool isLoading;
  final bool isRefreshing;

  SyncQueueState copyWith({
    List<SyncQueueDisplayItem>? items,
    bool? isLoading,
    bool? isRefreshing,
  }) {
    return SyncQueueState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
    );
  }

  @override
  List<Object?> get props => <Object?>[items, isLoading, isRefreshing];
}
