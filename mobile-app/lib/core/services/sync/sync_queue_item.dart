import 'dart:convert';

import 'package:machinery/core/services/sync/sync_operation_type.dart';
import 'package:machinery/core/utils/enums.dart';

/// One queued offline write, durable across app restarts (`07`).
///
/// `clientUuid` is the identity of the operation for its whole life — it is
/// generated on the device before anything else, and is what makes a replay
/// of the same push safe (the server answers `DUPLICATE`, never a second row).
class SyncQueueItem {
  const SyncQueueItem({
    required this.clientUuid,
    required this.type,
    required this.payload,
    required this.createdAt,
    required this.status,
    this.occurredAt,
    this.attemptCount = 0,
    this.lastAttemptAt,
    this.nextRetryAt,
    this.errorCode,
    this.errorMessage,
    this.serverState,
    this.serverId,
    this.priority = 1,
    this.dependsOn = const <String>[],
  });

  final String clientUuid;
  final SyncOperationType type;
  final Map<String, dynamic> payload;
  final DateTime? occurredAt;
  final DateTime createdAt;
  final int attemptCount;
  final DateTime? lastAttemptAt;
  final DateTime? nextRetryAt;
  final SyncItemStatus status;
  final String? errorCode;
  final String? errorMessage;

  /// What the server holds instead, on a `conflict` — rendered verbatim by
  /// the conflict dialog (`07`: "show a blocking, explicit dialog").
  final Map<String, dynamic>? serverState;

  /// The row this operation became once the server accepted it.
  final String? serverId;

  /// Media uploads are priority 0 (drain first); operations are priority 1.
  final int priority;

  /// `clientUuid`s of `pending_media` rows this operation's payload
  /// references. The queue never pushes an operation whose dependencies have
  /// not finished uploading yet.
  final List<String> dependsOn;

  SyncQueueItem copyWith({
    int? attemptCount,
    DateTime? lastAttemptAt,
    DateTime? nextRetryAt,
    SyncItemStatus? status,
    String? errorCode,
    String? errorMessage,
    Map<String, dynamic>? serverState,
    String? serverId,
    bool clearError = false,
  }) {
    return SyncQueueItem(
      clientUuid: clientUuid,
      type: type,
      payload: payload,
      occurredAt: occurredAt,
      createdAt: createdAt,
      attemptCount: attemptCount ?? this.attemptCount,
      lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
      nextRetryAt: nextRetryAt ?? this.nextRetryAt,
      status: status ?? this.status,
      errorCode: clearError ? null : (errorCode ?? this.errorCode),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      serverState: serverState ?? this.serverState,
      serverId: serverId ?? this.serverId,
      priority: priority,
      dependsOn: dependsOn,
    );
  }

  Map<String, dynamic> toRow() => <String, dynamic>{
    'client_uuid': clientUuid,
    'type': type.value,
    'payload': jsonEncode(payload),
    'occurred_at': occurredAt?.toUtc().toIso8601String(),
    'created_at': createdAt.toUtc().toIso8601String(),
    'attempt_count': attemptCount,
    'last_attempt_at': lastAttemptAt?.toUtc().toIso8601String(),
    'next_retry_at': nextRetryAt?.toUtc().toIso8601String(),
    'status': status.name,
    'error_code': errorCode,
    'error_message': errorMessage,
    'server_state': serverState == null ? null : jsonEncode(serverState),
    'server_id': serverId,
    'priority': priority,
    'depends_on': jsonEncode(dependsOn),
  };

  static SyncQueueItem fromRow(Map<String, dynamic> row) {
    final String? serverStateJson = row['server_state'] as String?;
    final List<dynamic> dependsOnRaw =
        jsonDecode(row['depends_on'] as String? ?? '[]') as List<dynamic>;

    return SyncQueueItem(
      clientUuid: row['client_uuid'] as String,
      type: SyncOperationType.fromJson(row['type'] as String?) ??
          SyncOperationType.createTransfer,
      payload: jsonDecode(row['payload'] as String) as Map<String, dynamic>,
      occurredAt: _dateOrNull(row['occurred_at']),
      createdAt: DateTime.parse(row['created_at'] as String),
      attemptCount: (row['attempt_count'] as int?) ?? 0,
      lastAttemptAt: _dateOrNull(row['last_attempt_at']),
      nextRetryAt: _dateOrNull(row['next_retry_at']),
      status: SyncItemStatus.values.firstWhere(
        (SyncItemStatus status) => status.name == row['status'],
        orElse: () => SyncItemStatus.pending,
      ),
      errorCode: row['error_code'] as String?,
      errorMessage: row['error_message'] as String?,
      serverState: serverStateJson == null
          ? null
          : jsonDecode(serverStateJson) as Map<String, dynamic>,
      serverId: row['server_id'] as String?,
      priority: (row['priority'] as int?) ?? 1,
      dependsOn: dependsOnRaw.cast<String>(),
    );
  }

  static DateTime? _dateOrNull(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value);
  }
}
