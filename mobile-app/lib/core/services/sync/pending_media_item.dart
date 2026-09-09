/// Where a staged upload is in its lifecycle (`07`, "Local media staging").
enum MediaUploadState {
  /// Written to disk, not yet attempted.
  staged,

  /// A `POST /media/upload` is in flight for it right now.
  uploading,

  /// The server confirmed it; `serverMediaId` is set and the local file may
  /// be deleted.
  uploaded,

  /// Every attempt failed with a permanent (4xx, not-a-network-problem) error.
  /// Whatever operation depends on it is stuck until a person intervenes.
  failed,
}

/// A photo or signature captured offline, staged on disk until it uploads
/// (`07`, `PendingMedia`).
class PendingMediaItem {
  const PendingMediaItem({
    required this.clientUuid,
    required this.localPath,
    required this.purpose,
    required this.mimeType,
    required this.sizeBytes,
    required this.checksum,
    required this.createdAt,
    required this.uploadState,
    this.serverMediaId,
    this.attemptCount = 0,
  });

  final String clientUuid;
  final String localPath;

  /// `TRANSFER_PHOTO`, `SIGNATURE`, `INVOICE` — the backend's `MediaPurpose`
  /// values, sent verbatim to `POST /media/upload`.
  final String purpose;
  final String mimeType;
  final int sizeBytes;
  final String checksum;
  final DateTime createdAt;
  final MediaUploadState uploadState;
  final String? serverMediaId;
  final int attemptCount;

  PendingMediaItem copyWith({
    MediaUploadState? uploadState,
    String? serverMediaId,
    int? attemptCount,
  }) {
    return PendingMediaItem(
      clientUuid: clientUuid,
      localPath: localPath,
      purpose: purpose,
      mimeType: mimeType,
      sizeBytes: sizeBytes,
      checksum: checksum,
      createdAt: createdAt,
      uploadState: uploadState ?? this.uploadState,
      serverMediaId: serverMediaId ?? this.serverMediaId,
      attemptCount: attemptCount ?? this.attemptCount,
    );
  }

  Map<String, dynamic> toRow() => <String, dynamic>{
    'client_uuid': clientUuid,
    'local_path': localPath,
    'purpose': purpose,
    'mime_type': mimeType,
    'size_bytes': sizeBytes,
    'checksum': checksum,
    'server_media_id': serverMediaId,
    'upload_state': uploadState.name,
    'attempt_count': attemptCount,
    'created_at': createdAt.toUtc().toIso8601String(),
  };

  static PendingMediaItem fromRow(Map<String, dynamic> row) {
    return PendingMediaItem(
      clientUuid: row['client_uuid'] as String,
      localPath: row['local_path'] as String,
      purpose: row['purpose'] as String,
      mimeType: row['mime_type'] as String,
      sizeBytes: (row['size_bytes'] as num).toInt(),
      checksum: row['checksum'] as String,
      createdAt: DateTime.parse(row['created_at'] as String),
      uploadState: MediaUploadState.values.firstWhere(
        (MediaUploadState state) => state.name == row['upload_state'],
        orElse: () => MediaUploadState.staged,
      ),
      serverMediaId: row['server_media_id'] as String?,
      attemptCount: (row['attempt_count'] as int?) ?? 0,
    );
  }
}
