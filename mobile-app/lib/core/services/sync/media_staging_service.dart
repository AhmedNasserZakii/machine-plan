import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/local_db/daos/pending_media_dao.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/core/services/sync/pending_media_item.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

/// Stages a captured photo or signature on disk and drains it to the server,
/// independently of whatever operation will eventually reference it (`07`,
/// "Implement offline media staging").
///
/// Uses the direct multipart `POST /media/upload` (`clientUuid` attached)
/// rather than the presign→PUT→confirm handshake the *online* transfer flow
/// uses: a background retry loop only has to redo one call on failure instead
/// of re-deriving three, and the server already accepts either path
/// interchangeably (`media.service.ts`, `upload()`).
class MediaStagingService {
  MediaStagingService({
    required this.pendingMediaDao,
    required this.apiService,
    required this.networkInfo,
  });

  final PendingMediaDao pendingMediaDao;
  final ApiService apiService;
  final NetworkInfo networkInfo;

  static const int _maxAttemptsBeforeFailed = 10;

  /// Writes [bytes] under the app's own documents directory and records a
  /// `pending_media` row for it. Returns the `clientUuid` the caller embeds
  /// in its operation payload (as `signatureMediaId`/`photoMediaIds`/etc,
  /// resolved server-side once the upload lands — `media-references.ts`).
  Future<String> stage({
    required Uint8List bytes,
    required String purpose,
    required String mimeType,
  }) async {
    final String clientUuid = const Uuid().v4();
    final Directory dir = await _stagingDir();
    final String extension = _extensionFor(mimeType);
    final File file = File(p.join(dir.path, '$clientUuid.$extension'));
    await file.writeAsBytes(bytes, flush: true);

    final PendingMediaItem item = PendingMediaItem(
      clientUuid: clientUuid,
      localPath: file.path,
      purpose: purpose,
      mimeType: mimeType,
      sizeBytes: bytes.lengthInBytes,
      checksum: sha256.convert(bytes).toString(),
      createdAt: DateTime.now().toUtc(),
      uploadState: MediaUploadState.staged,
    );
    await pendingMediaDao.insert(item);

    return clientUuid;
  }

  /// Process kill mid-upload leaves rows stuck in `uploading`. Call once at
  /// app start (and before every flush) so retries resume cleanly.
  Future<int> recoverInterruptedUploads() =>
      pendingMediaDao.resetInterruptedUploads();

  /// Every staged/uploading/previously-failed row that isn't uploaded yet.
  /// `flush()` in `SyncQueueService` drains these before pushing any
  /// operation, since an operation referencing an unresolved media id comes
  /// back `RETRY` (`batch-outcome.ts`) — wasting a round trip that staying in
  /// order avoids entirely.
  Future<void> uploadAllPending() async {
    if (!await networkInfo.isConnected) return;

    for (final PendingMediaItem item in await pendingMediaDao.notUploaded()) {
      if (item.uploadState == MediaUploadState.failed) continue;
      await uploadOne(item);
    }
  }

  /// A single attempt. Public so the sync-queue screen's manual "retry now"
  /// can drive one staged upload directly.
  Future<bool> uploadOne(PendingMediaItem item) async {
    final File file = File(item.localPath);
    if (!file.existsSync()) {
      // The file is gone (storage cleared, app data wiped by the OS) and
      // there is nothing left to upload — this can never succeed by retrying.
      await pendingMediaDao
          .update(item.copyWith(uploadState: MediaUploadState.failed));
      return false;
    }

    await pendingMediaDao
        .update(item.copyWith(uploadState: MediaUploadState.uploading));

    try {
      final Response<dynamic> response =
          await apiService.client().post<dynamic>(
                WebConstant.mediaUpload,
                data: FormData.fromMap(<String, dynamic>{
                  'purpose': item.purpose,
                  'clientUuid': item.clientUuid,
                  'file': await MultipartFile.fromFile(file.path,
                      filename: p.basename(file.path)),
                }),
              );

      final Map<String, dynamic> body = response.data is Map<String, dynamic>
          ? response.data as Map<String, dynamic>
          : const <String, dynamic>{};
      final Map<String, dynamic> data = body['data'] is Map<String, dynamic>
          ? body['data'] as Map<String, dynamic>
          : body;
      final String? serverMediaId = data['id'] as String?;

      await pendingMediaDao.update(
        item.copyWith(
            uploadState: MediaUploadState.uploaded,
            serverMediaId: serverMediaId),
      );

      // The evidence is safe on the server now; the local copy only ever
      // existed to survive a restart before that (`07`, "Storage hygiene").
      if (await file.exists()) await file.delete();

      return true;
    } on DioException catch (error, stackTrace) {
      printDebug(
          message: 'media staging upload failed: ${error.message}',
          stackTrace: stackTrace);

      final int attempts = item.attemptCount + 1;
      final bool permanent =
          _isPermanentFailure(error) || attempts >= _maxAttemptsBeforeFailed;

      await pendingMediaDao.update(
        item.copyWith(
          uploadState:
              permanent ? MediaUploadState.failed : MediaUploadState.staged,
          attemptCount: attempts,
        ),
      );
      return false;
    }
  }

  /// A 4xx (bad purpose, oversized, wrong mime type) will never succeed by
  /// retrying unchanged — the same DISCARD-vs-RETRY split the backend applies
  /// to a queued operation's own failure (`batch-outcome.ts`).
  bool _isPermanentFailure(DioException error) {
    final int? status = error.response?.statusCode;
    return status != null && status >= 400 && status < 500;
  }

  /// Deletes a staged file that no queued operation will ever reference again
  /// — the operation that would have used it was itself deleted from the
  /// queue (a `DISCARD`ed failure, or the user deleting a failed item by
  /// hand). Called by `SyncQueueService` after removing an item, never on a
  /// timer, so an upload still legitimately in flight is never swept.
  Future<void> deleteStaged(String clientUuid) async {
    final PendingMediaItem? item =
        await pendingMediaDao.findByClientUuid(clientUuid);
    if (item == null) return;

    final File file = File(item.localPath);
    if (await file.exists()) await file.delete();
    await pendingMediaDao.delete(clientUuid);
  }

  Future<Directory> _stagingDir() async {
    final Directory documents = await getApplicationDocumentsDirectory();
    final Directory dir = Directory(p.join(documents.path, 'pending_media'));
    if (!dir.existsSync()) await dir.create(recursive: true);
    return dir;
  }

  String _extensionFor(String mimeType) => switch (mimeType) {
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
        _ => 'jpg',
      };
}
