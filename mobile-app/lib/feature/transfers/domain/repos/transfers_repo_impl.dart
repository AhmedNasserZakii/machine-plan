import 'dart:async';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/local_db/daos/cached_transfers_dao.dart';
import 'package:machinery/core/local_db/daos/pending_media_dao.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/core/services/sync/media_staging_service.dart';
import 'package:machinery/core/services/sync/pending_media_item.dart';
import 'package:machinery/core/services/sync/sync_coordinator.dart';
import 'package:machinery/core/services/sync/sync_operation_type.dart';
import 'package:machinery/core/services/sync/sync_queue_item.dart';
import 'package:machinery/core/services/sync/sync_queue_service.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/data/models/transfer_response_model.dart';
import 'package:machinery/feature/transfers/domain/entities/creatable_transfer_type.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';
import 'package:machinery/feature/transfers/domain/params/transfers_query_params.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo.dart';
import 'package:uuid/uuid.dart';

/// Media purposes the backend accepts. Sent as-is; the server enforces the size
/// and format limits per purpose.
const String _signaturePurpose = 'SIGNATURE';
const String _transferPhotoPurpose = 'TRANSFER_PHOTO';

class TransfersRepoImpl implements TransfersRepo {
  TransfersRepoImpl({
    required this.apiService,
    required this.networkInfo,
    required this.cachedTransfersDao,
    required this.pendingMediaDao,
    required this.mediaStaging,
    required this.syncQueueService,
    required this.syncCoordinator,
  });

  final ApiService apiService;
  final NetworkInfo networkInfo;
  final CachedTransfersDao cachedTransfersDao;
  final PendingMediaDao pendingMediaDao;
  final MediaStagingService mediaStaging;
  final SyncQueueService syncQueueService;
  final SyncCoordinator syncCoordinator;

  /// Local-first (`6.2`): online, unchanged — a network list written through
  /// to the cache. Offline, falls back to whatever pending transfers the last
  /// bootstrap/delta downloaded — the cache holds exactly the set the backend
  /// already scopes to "awaiting the caller's signature" (`SyncBootstrapResponse.pendingTransfers`),
  /// which is the one scope a rep can act on (confirm) without a connection
  /// anyway; incoming/outgoing history for a branch/company view genuinely
  /// needs the server and is not pretended to work offline.
  @override
  Future<Either<ServerFailure, TransfersPage>> fetchTransfers({
    required TransfersQueryParams params,
  }) async {
    if (await networkInfo.isConnected) {
      try {
        final Response<dynamic> response = await apiService.client().get<dynamic>(
          _pathFor(params.scope),
          queryParameters: params.toQuery(),
        );

        final Map<String, dynamic> body = _body(response.data);
        final List<Map<String, dynamic>> rows = _list(body[ApiKeys.data]);
        if (params.scope == TransfersScope.incoming) {
          await cachedTransfersDao.upsertAll(rows);
        }

        return Right(
          TransfersPage(
            transfers: rows
                .map((Map<String, dynamic> json) => TransferResponseModel.fromJson(json).toEntity())
                .toList(growable: false),
            meta: _metaOf(body),
          ),
        );
      } on DioException catch (error, stackTrace) {
        printDebug(message: 'transfers repo fetchTransfers dio exception: ${error.message}', stackTrace: stackTrace);
        return _transfersFromCache(params);
      } catch (error, stackTrace) {
        printDebug(message: 'transfers repo fetchTransfers catch: $error', stackTrace: stackTrace);
        return _transfersFromCache(params);
      }
    }

    return _transfersFromCache(params);
  }

  Future<Either<ServerFailure, TransfersPage>> _transfersFromCache(
    TransfersQueryParams params,
  ) async {
    if (params.scope != TransfersScope.incoming) {
      // Nothing but "awaiting my signature" is cached — an outgoing/all-scope
      // list offline would just be a wrong, empty answer dressed as a real one.
      return Left(OfflineFailure());
    }

    final List<TransferEntity> transfers = await cachedTransfersDao.all();
    return Right(
      TransfersPage(
        transfers: transfers,
        meta: PaginationMetaModel(
          page: 1,
          limit: transfers.length,
          total: transfers.length,
          totalPages: 1,
          hasNext: false,
        ),
      ),
    );
  }

  @override
  Future<Either<ServerFailure, TransferEntity>> fetchTransfer({
    required String id,
  }) async {
    if (await networkInfo.isConnected) {
      try {
        final Response<dynamic> response = await apiService.client().get<dynamic>(
          WebConstant.transfer(id),
        );
        final Map<String, dynamic> json = _data(response.data);
        await cachedTransfersDao.upsertOne(json);
        return Right(TransferResponseModel.fromJson(json).toEntity());
      } on DioException catch (error, stackTrace) {
        printDebug(message: 'transfers repo fetchTransfer dio exception: ${error.message}', stackTrace: stackTrace);
        return _transferFromCache(id);
      } catch (error, stackTrace) {
        printDebug(message: 'transfers repo fetchTransfer catch: $error', stackTrace: stackTrace);
        return _transferFromCache(id);
      }
    }

    return _transferFromCache(id);
  }

  Future<Either<ServerFailure, TransferEntity>> _transferFromCache(String id) async {
    final TransferEntity? cached = await cachedTransfersDao.findById(id);
    return cached == null ? Left(OfflineFailure()) : Right(cached);
  }

  @override
  Future<Either<ServerFailure, TransferValidation>> validate({
    required CreateTransferParams params,
  }) {
    return _guard('validate', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(WebConstant.transfersValidate, data: params.toJson());

      final Map<String, dynamic> data = _data(response.data);

      return TransferValidation(
        valid: data[ApiKeys.valid] == true,
        problems: _problems(data[ApiKeys.problems]),
      );
    });
  }

  /// Recording a hand-off is the operation the whole offline design exists
  /// for (`07`, `6.4`) — a rep does this in a shop with no signal. Online,
  /// unchanged. Offline, queues `CREATE_TRANSFER` and returns an optimistic
  /// row; any photo/signature the item references that is still a staged
  /// local upload (rather than an already-confirmed server media id) becomes
  /// a `dependsOn` entry, so the queue never pushes this operation before its
  /// evidence has actually landed.
  @override
  Future<Either<ServerFailure, TransferEntity>> createTransfer({
    required CreateTransferParams params,
  }) async {
    if (!await networkInfo.isConnected) {
      return _queueCreateTransfer(params);
    }

    return _guard('createTransfer', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(WebConstant.transfers, data: params.toJson());

      final Map<String, dynamic> json = _data(response.data);
      await cachedTransfersDao.upsertOne(json);
      return TransferResponseModel.fromJson(json).toEntity();
    });
  }

  Future<Either<ServerFailure, TransferEntity>> _queueCreateTransfer(
    CreateTransferParams params,
  ) async {
    final List<String> dependsOn = await _unresolvedMediaIds(_mediaIdsIn(params));
    final DateTime now = DateTime.now().toUtc();

    final Map<String, dynamic> optimisticJson = <String, dynamic>{
      ApiKeys.id: params.clientUuid,
      ApiKeys.referenceNo: '—',
      ApiKeys.type: params.type.value,
      ApiKeys.direction: TransferDirection.out.value,
      ApiKeys.status: TransferStatus.pending.value,
      ApiKeys.to: <String, dynamic>{'id': params.toPartyId},
      ApiKeys.occurredAt: params.occurredAt.toUtc().toIso8601String(),
      ApiKeys.itemsCount: params.items.length,
      ApiKeys.createdAt: now.toIso8601String(),
      ApiKeys.notes: params.notes,
      ApiKeys.items: params.items
          .map(
            (TransferItemParams item) => <String, dynamic>{
              ApiKeys.id: 'local-${item.machineId}',
              ApiKeys.machine: <String, dynamic>{ApiKeys.id: item.machineId},
              ApiKeys.hasCharger: item.hasCharger,
              ApiKeys.hasBox: item.hasBox,
              ApiKeys.condition: item.condition.value,
              ApiKeys.batterySerialScanned: item.batterySerialScanned,
              ApiKeys.simSerialScanned: item.simSerialScanned,
              ApiKeys.boxSerialScanned: item.boxSerialScanned,
              ApiKeys.notes: item.notes,
              ApiKeys.photos: item.photoMediaIds
                  .map((String id) => <String, dynamic>{ApiKeys.id: id, ApiKeys.mediaId: id})
                  .toList(growable: false),
            },
          )
          .toList(growable: false),
    };

    await cachedTransfersDao.upsertOne(optimisticJson);
    await syncQueueService.enqueue(
      SyncQueueItem(
        clientUuid: params.clientUuid,
        type: SyncOperationType.createTransfer,
        payload: params.toJson(),
        createdAt: now,
        occurredAt: params.occurredAt,
        status: SyncItemStatus.pending,
        dependsOn: dependsOn,
      ),
    );

    syncCoordinator.notifyChange();
    unawaited(syncCoordinator.flush());

    return Right(TransferResponseModel.fromJson(optimisticJson).toEntity());
  }

  /// Signing for a hand-off already downloaded (`pendingTransfers`) is the
  /// other offline-capable write. `id` is a real server id in every case —
  /// this only ever confirms a transfer that arrived through a bootstrap or
  /// delta pull, never one still sitting in the local queue as an
  /// unresolved `CREATE_TRANSFER`.
  @override
  Future<Either<ServerFailure, TransferEntity>> confirmTransfer({
    required String id,
    required ConfirmTransferParams params,
  }) async {
    if (!await networkInfo.isConnected) {
      return _queueConfirmTransfer(id, params);
    }

    return _guard('confirmTransfer', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(
            WebConstant.transferConfirm(id),
            data: params.toJson(),
          );

      final Map<String, dynamic> json = _data(response.data);
      await cachedTransfersDao.upsertOne(json);
      return TransferResponseModel.fromJson(json).toEntity();
    });
  }

  Future<Either<ServerFailure, TransferEntity>> _queueConfirmTransfer(
    String id,
    ConfirmTransferParams params,
  ) async {
    final List<String> mediaIds = <String>[
      if (params.signature.signatureMediaId != null) params.signature.signatureMediaId!,
    ];
    final List<String> dependsOn = await _unresolvedMediaIds(mediaIds);

    final String clientUuid = const Uuid().v4();
    final DateTime now = DateTime.now().toUtc();

    final TransferEntity? existing = await cachedTransfersDao.findById(id);
    if (existing == null) {
      // Confirming something this device never downloaded cannot be queued
      // meaningfully — there is no local row to show as "pending" and no way
      // to know it is even still awaiting this user's signature.
      return Left(OfflineFailure());
    }

    await syncQueueService.enqueue(
      SyncQueueItem(
        clientUuid: clientUuid,
        type: SyncOperationType.confirmTransfer,
        payload: <String, dynamic>{...params.toJson(), ApiKeys.transferId: id},
        createdAt: now,
        occurredAt: now,
        status: SyncItemStatus.pending,
        dependsOn: dependsOn,
      ),
    );

    syncCoordinator.notifyChange();
    unawaited(syncCoordinator.flush());

    // The optimistic view: still the transfer as downloaded, but no longer
    // shown as awaiting signature — `CONFIRMED` is provisional until the
    // queue actually lands it; a conflict rolls this back via the next sync.
    return Right(existing);
  }

  /// Every media id this payload references, wherever it sits in the item
  /// tree — mirrors the backend's own `collectMediaReferences` field-name
  /// convention (`mediaId`/`*MediaId`/`*MediaIds`) so the two never drift.
  List<String> _mediaIdsIn(CreateTransferParams params) {
    final List<String> ids = <String>[];
    if (params.senderSignature?.signatureMediaId != null) {
      ids.add(params.senderSignature!.signatureMediaId!);
    }
    for (final TransferItemParams item in params.items) {
      ids.addAll(item.photoMediaIds);
    }
    return ids;
  }

  /// Of the given media ids, which ones are this device's own staged
  /// uploads that have not finished yet. An id this device never staged
  /// (created online, already a confirmed server id) is not a dependency —
  /// there is nothing local left to wait for.
  Future<List<String>> _unresolvedMediaIds(List<String> mediaIds) async {
    if (mediaIds.isEmpty) return const <String>[];

    final List<PendingMediaItem> staged = await pendingMediaDao.findByClientUuids(mediaIds);
    return staged
        .where((PendingMediaItem media) => media.uploadState != MediaUploadState.uploaded)
        .map((PendingMediaItem media) => media.clientUuid)
        .toList(growable: false);
  }

  @override
  Future<Either<ServerFailure, TransferEntity>> rejectTransfer({
    required String id,
    required String reason,
  }) async {
    if (!await networkInfo.isConnected) {
      return _queueRejectTransfer(id, reason);
    }

    return _guard('rejectTransfer', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(
            WebConstant.transferReject(id),
            data: <String, dynamic>{ApiKeys.reason: reason.trim()},
          );

      final Map<String, dynamic> json = _data(response.data);
      await cachedTransfersDao.upsertOne(json);
      return TransferResponseModel.fromJson(json).toEntity();
    });
  }

  /// Mirrors `_queueConfirmTransfer` — a rejection carries no media, so there
  /// is nothing to wait on before pushing it, just the same optimistic
  /// "still pending" view until the queue lands it and the receiver's inbox
  /// entry actually clears.
  Future<Either<ServerFailure, TransferEntity>> _queueRejectTransfer(
    String id,
    String reason,
  ) async {
    final TransferEntity? existing = await cachedTransfersDao.findById(id);
    if (existing == null) {
      return Left(OfflineFailure());
    }

    final DateTime now = DateTime.now().toUtc();

    await syncQueueService.enqueue(
      SyncQueueItem(
        clientUuid: const Uuid().v4(),
        type: SyncOperationType.rejectTransfer,
        payload: <String, dynamic>{
          ApiKeys.transferId: id,
          ApiKeys.reason: reason.trim(),
        },
        createdAt: now,
        occurredAt: now,
        status: SyncItemStatus.pending,
      ),
    );

    syncCoordinator.notifyChange();
    unawaited(syncCoordinator.flush());

    return Right(existing);
  }

  @override
  Future<Either<ServerFailure, TransferEntity>> cancelTransfer({
    required String id,
    String? reason,
  }) {
    return _guard('cancelTransfer', () async {
      final String? trimmed = reason?.trim();

      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(
            WebConstant.transferCancel(id),
            data: <String, dynamic>{
              if (trimmed != null && trimmed.isNotEmpty)
                ApiKeys.reason: trimmed,
            },
          );

      return TransferResponseModel.fromJson(_data(response.data)).toEntity();
    });
  }

  /// Online: the existing presign→PUT→confirm handshake, a real server media
  /// id back immediately. Offline (`6.5`): staged to disk instead of failing
  /// — the returned id is the *local* `clientUuid` `MediaStagingService`
  /// assigned it, used identically to a real media id everywhere this app
  /// puts it (`signatureMediaId`, `photoMediaIds`), because the backend
  /// resolves either one the same way once the upload lands
  /// (`media-references.ts`, `resolveClientUuids`).
  @override
  Future<Either<ServerFailure, String>> uploadSignature({
    required Uint8List png,
  }) async {
    if (!await networkInfo.isConnected) {
      return Right(await mediaStaging.stage(bytes: png, purpose: _signaturePurpose, mimeType: 'image/png'));
    }
    return _guard(
      'uploadSignature',
      () => _upload(png, _signaturePurpose, 'image/png'),
    );
  }

  @override
  Future<Either<ServerFailure, String>> uploadItemPhoto({
    required Uint8List jpeg,
  }) async {
    if (!await networkInfo.isConnected) {
      return Right(
        await mediaStaging.stage(bytes: jpeg, purpose: _transferPhotoPurpose, mimeType: 'image/jpeg'),
      );
    }
    return _guard(
      'uploadItemPhoto',
      () => _upload(jpeg, _transferPhotoPurpose, 'image/jpeg'),
    );
  }

  @override
  Future<Either<ServerFailure, String>> fetchSignatureMediaUrl({
    required String transferId,
    required String signatureId,
  }) {
    return _guard('fetchSignatureMediaUrl', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.transferSignatureMedia(transferId, signatureId),
      );

      final String? url = _data(response.data)[ApiKeys.url] as String?;
      if (url == null || url.isEmpty) {
        throw StateError('signature media response had no url');
      }
      return url;
    });
  }

  @override
  Future<Either<ServerFailure, List<CreatableTransferType>>>
  fetchCreatableTypes() {
    return _guard('fetchCreatableTypes', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.transfersCreatableTypes,
      );

      return _list(_body(response.data)[ApiKeys.data])
          .map(
            (Map<String, dynamic> json) => CreatableTransferType(
              type: TransferType.fromJson(json[ApiKeys.type] as String?),
              receiverKind: ReceiverKind.fromJson(
                json[ApiKeys.receiverKind] as String?,
              ),
              selfAttested: json[ApiKeys.selfAttested] == true,
              allowedFromStatuses: _statuses(json[ApiKeys.allowedFromStatuses]),
            ),
          )
          .where(
            (CreatableTransferType option) =>
                option.type != TransferType.unknown,
          )
          .toList(growable: false);
    });
  }

  @override
  Future<Either<ServerFailure, TransferRecipientsPage>> fetchRecipients({
    required TransferType type,
    int page = 1,
    String? search,
  }) {
    return _guard('fetchRecipients', () async {
      final String? trimmed = search?.trim();
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.transfersRecipients,
        queryParameters: <String, dynamic>{
          ApiKeys.type: type.value,
          ApiKeys.page: page,
          ApiKeys.limit: 20,
          if (trimmed != null && trimmed.isNotEmpty) ApiKeys.search: trimmed,
        },
      );

      final Map<String, dynamic> body = _body(response.data);
      return TransferRecipientsPage(
        recipients: _list(body[ApiKeys.data])
            .map(
              (Map<String, dynamic> json) => TransferRecipient(
                id: json[ApiKeys.id] as String? ?? '',
                name: json[ApiKeys.name] as String? ?? '',
                subtitle: json[ApiKeys.subtitle] as String?,
              ),
            )
            .where((TransferRecipient recipient) => recipient.id.isNotEmpty)
            .toList(growable: false),
        meta: _metaOf(body),
      );
    });
  }

  /// Reserve a key, PUT the bytes straight at storage, then confirm. The API
  /// server never carries the image itself, which is what makes a field upload
  /// on a weak connection survivable.
  Future<String> _upload(
    Uint8List bytes,
    String purpose,
    String mimeType,
  ) async {
    final Response<dynamic> reserved = await apiService.client().post<dynamic>(
      WebConstant.mediaPresign,
      data: <String, dynamic>{
        ApiKeys.purpose: purpose,
        ApiKeys.mimeType: mimeType,
        ApiKeys.sizeBytes: bytes.lengthInBytes,
        ApiKeys.checksum: sha256.convert(bytes).toString(),
      },
    );

    final Map<String, dynamic> presign = _data(reserved.data);
    final String mediaId = presign[ApiKeys.id] is String
        ? presign[ApiKeys.id] as String
        : presign[ApiKeys.mediaId] as String;

    // The upload URL is absolute and pre-signed, so it deliberately bypasses
    // the client's base URL and auth header.
    await Dio().putUri<dynamic>(
      Uri.parse(presign[ApiKeys.uploadUrl] as String),
      data: Stream<List<int>>.fromIterable(<List<int>>[bytes]),
      options: Options(
        headers: <String, dynamic>{
          Headers.contentTypeHeader: mimeType,
          Headers.contentLengthHeader: bytes.lengthInBytes,
        },
      ),
    );

    await apiService.client().post<dynamic>(
      WebConstant.mediaConfirm,
      data: <String, dynamic>{ApiKeys.mediaId: mediaId},
    );

    return mediaId;
  }

  List<MachineStatus> _statuses(dynamic raw) {
    if (raw is! List) return const <MachineStatus>[];

    return raw
        .whereType<String>()
        .map(MachineStatus.fromJson)
        .where((MachineStatus status) => status != MachineStatus.unknown)
        .toList(growable: false);
  }

  String _pathFor(TransfersScope scope) => switch (scope) {
    TransfersScope.incoming => WebConstant.transfersIncoming,
    TransfersScope.outgoing => WebConstant.transfersOutgoing,
    TransfersScope.all => WebConstant.transfers,
  };

  /// The dry run returns a heterogeneous list — validation details, or a bare
  /// error code. Flattened to readable lines rather than surfaced as raw JSON.
  List<String> _problems(dynamic raw) {
    if (raw is! List) return const <String>[];

    return raw
        .map((dynamic problem) {
          if (problem is Map<String, dynamic>) {
            final Object? field = problem[ApiKeys.field];
            final Object? constraint = problem[ApiKeys.constraint];
            return <Object?>[field, constraint].whereType<String>().join(': ');
          }
          return problem?.toString() ?? '';
        })
        .where((String line) => line.isNotEmpty)
        .toList(growable: false);
  }

  Future<Either<ServerFailure, T>> _guard<T>(
    String label,
    Future<T> Function() run,
  ) async {
    try {
      if (!await networkInfo.isConnected) {
        return Left(OfflineFailure());
      }

      return Right(await run());
    } on DioException catch (error, stackTrace) {
      printDebug(
        message: 'transfers repo $label dio exception: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'transfers repo $label catch: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
    }
  }

  static Map<String, dynamic> _body(dynamic raw) =>
      raw is Map<String, dynamic> ? raw : const <String, dynamic>{};

  static Map<String, dynamic> _data(dynamic raw) {
    final dynamic data = _body(raw)[ApiKeys.data];
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  static List<Map<String, dynamic>> _list(dynamic raw) {
    if (raw is List) {
      return raw.whereType<Map<String, dynamic>>().toList(growable: false);
    }
    return const <Map<String, dynamic>>[];
  }

  static PaginationMetaModel _metaOf(Map<String, dynamic> body) {
    final dynamic meta = body[ApiKeys.meta];
    return PaginationMetaModel.fromJson(
      meta is Map<String, dynamic> ? meta : const <String, dynamic>{},
    );
  }
}
