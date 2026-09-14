import 'dart:async';

import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/local_db/daos/cached_merchants_dao.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/core/network_services/paginated_fetch.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/core/services/sync/sync_coordinator.dart';
import 'package:machinery/core/services/sync/sync_operation_type.dart';
import 'package:machinery/core/services/sync/sync_queue_item.dart';
import 'package:machinery/core/services/sync/sync_queue_service.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/data/models/machine_response_model.dart';
import 'package:machinery/feature/merchants/data/models/merchant_response_model.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/domain/params/merchant_form_params.dart';
import 'package:machinery/feature/merchants/domain/params/merchants_query_params.dart';
import 'package:machinery/feature/merchants/domain/repos/merchants_repo.dart';
import 'package:machinery/feature/users/data/models/branch_model.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';
import 'package:uuid/uuid.dart';

class MerchantsRepoImpl implements MerchantsRepo {
  MerchantsRepoImpl({
    required this.apiService,
    required this.networkInfo,
    required this.cachedMerchantsDao,
    required this.syncQueueService,
    required this.syncCoordinator,
  });

  final ApiService apiService;
  final NetworkInfo networkInfo;
  final CachedMerchantsDao cachedMerchantsDao;
  final SyncQueueService syncQueueService;
  final SyncCoordinator syncCoordinator;

  /// Local-first (`6.2`): identical to before while online — a network list,
  /// written through to the cache — and a substring-on-name/phone/shop-name
  /// fallback to the cache once there is no connection. Merchant search has
  /// no server-side filters beyond `search` itself, so nothing offline is
  /// silently dropped the way it is in `MachinesRepoImpl`.
  @override
  Future<Either<ServerFailure, MerchantsPage>> fetchMerchants({
    required MerchantsQueryParams params,
  }) async {
    if (await networkInfo.isConnected) {
      try {
        final Response<dynamic> response = await apiService.client().get<dynamic>(
          WebConstant.merchants,
          queryParameters: params.toQuery(),
        );

        final Map<String, dynamic> body = _body(response.data);
        final List<Map<String, dynamic>> rows = _list(body[ApiKeys.data]);
        await cachedMerchantsDao.upsertAll(rows);

        return Right(
          MerchantsPage(
            merchants: rows
                .map((Map<String, dynamic> json) => MerchantResponseModel.fromJson(json).toEntity())
                .toList(growable: false),
            meta: _metaOf(body),
          ),
        );
      } on DioException catch (error, stackTrace) {
        printDebug(message: 'merchants repo fetchMerchants dio exception: ${error.message}', stackTrace: stackTrace);
        return _merchantsFromCache(params);
      } catch (error, stackTrace) {
        printDebug(message: 'merchants repo fetchMerchants catch: $error', stackTrace: stackTrace);
        return _merchantsFromCache(params);
      }
    }

    return _merchantsFromCache(params);
  }

  Future<Either<ServerFailure, MerchantsPage>> _merchantsFromCache(
    MerchantsQueryParams params,
  ) async {
    final List<MerchantEntity> merchants = await cachedMerchantsDao.search(query: params.search);
    return Right(
      MerchantsPage(
        merchants: merchants,
        meta: PaginationMetaModel(
          page: 1,
          limit: merchants.length,
          total: merchants.length,
          totalPages: 1,
          hasNext: false,
        ),
      ),
    );
  }

  @override
  Future<Either<ServerFailure, MerchantEntity>> fetchMerchant({
    required String id,
  }) async {
    if (await networkInfo.isConnected) {
      try {
        final Response<dynamic> response = await apiService.client().get<dynamic>(
          WebConstant.merchant(id),
        );
        final Map<String, dynamic> json = _data(response.data);
        await cachedMerchantsDao.upsertOne(json);
        return Right(MerchantResponseModel.fromJson(json).toEntity());
      } on DioException catch (error, stackTrace) {
        printDebug(message: 'merchants repo fetchMerchant dio exception: ${error.message}', stackTrace: stackTrace);
        return _merchantFromCache(id);
      } catch (error, stackTrace) {
        printDebug(message: 'merchants repo fetchMerchant catch: $error', stackTrace: stackTrace);
        return _merchantFromCache(id);
      }
    }

    return _merchantFromCache(id);
  }

  Future<Either<ServerFailure, MerchantEntity>> _merchantFromCache(String id) async {
    final MerchantEntity? cached = await cachedMerchantsDao.findById(id);
    return cached == null ? Left(OfflineFailure()) : Right(cached);
  }

  @override
  Future<Either<ServerFailure, MerchantMachinesPage>> fetchMerchantMachines({
    required String id,
    int page = 1,
  }) {
    return _guard('fetchMerchantMachines', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.merchantMachines(id),
        queryParameters: <String, dynamic>{
          ApiKeys.page: page,
          ApiKeys.limit: 20,
        },
      );

      final Map<String, dynamic> body = _body(response.data);
      return MerchantMachinesPage(
        machines: _list(body[ApiKeys.data])
            .map(
              (Map<String, dynamic> json) =>
                  MachineResponseModel.fromJson(json).toEntity(),
            )
            .toList(growable: false),
        meta: _metaOf(body),
      );
    });
  }

  @override
  Future<Either<ServerFailure, MerchantSubscriptionsPage>> fetchSubscriptions({
    required String id,
    int page = 1,
  }) {
    return _guard('fetchSubscriptions', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.merchantSubscriptions(id),
        queryParameters: <String, dynamic>{
          ApiKeys.page: page,
          ApiKeys.limit: 20,
        },
      );

      final Map<String, dynamic> body = _body(response.data);
      return MerchantSubscriptionsPage(
        subscriptions: _list(body[ApiKeys.data])
            .map(
              (Map<String, dynamic> json) =>
                  SubscriptionResponseModel.fromJson(json).toEntity(),
            )
            .toList(growable: false),
        meta: _metaOf(body),
      );
    });
  }

  @override
  Future<Either<ServerFailure, MerchantTimelinePage>> fetchTimeline({
    required String id,
    String? cursor,
  }) {
    return _guard('fetchTimeline', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.merchantTimeline(id),
        queryParameters: <String, dynamic>{
          if (cursor != null && cursor.isNotEmpty) ApiKeys.cursor: cursor,
        },
      );

      final Map<String, dynamic> body = _body(response.data);
      return MerchantTimelinePage(
        entries: _list(body[ApiKeys.data])
            .map(
              (Map<String, dynamic> json) =>
                  MerchantTimelineEntryModel.fromJson(json).toEntity(),
            )
            .toList(growable: false),
        meta: _metaOf(body),
      );
    });
  }

  @override
  Future<Either<ServerFailure, MerchantDuplicateCheck>> checkDuplicates({
    required CheckMerchantParams params,
  }) {
    return _guard('checkDuplicates', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(WebConstant.merchantsCheck, data: params.toJson());

      return MerchantDuplicateCheckModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  /// Registering a merchant is one of the three writes this app can make with
  /// no connection (`07`, `6.4`) — a rep does this standing in the shop he is
  /// signing up. Online, this is unchanged from before. Offline, it queues
  /// `CREATE_MERCHANT` and returns an optimistic row immediately; the queue
  /// resolves the real id the next time it can reach the server, and the
  /// following delta pull replaces this optimistic cache row with the
  /// authoritative one.
  @override
  Future<Either<ServerFailure, MerchantEntity>> createMerchant({
    required CreateMerchantParams params,
  }) async {
    if (!await networkInfo.isConnected) {
      return _queueCreateMerchant(params);
    }

    return _guard('createMerchant', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(WebConstant.merchants, data: params.toJson());

      final Map<String, dynamic> json = _data(response.data);
      await cachedMerchantsDao.upsertOne(json);
      return MerchantResponseModel.fromJson(json).toEntity();
    });
  }

  Future<Either<ServerFailure, MerchantEntity>> _queueCreateMerchant(
    CreateMerchantParams params,
  ) async {
    final String clientUuid = params.clientUuid ?? const Uuid().v4();
    final DateTime now = DateTime.now().toUtc();

    final Map<String, dynamic> optimisticJson = <String, dynamic>{
      ApiKeys.id: clientUuid,
      ApiKeys.name: params.name.trim(),
      ApiKeys.phone: params.phone.trim(),
      ApiKeys.shopName: params.shopName.trim(),
      ApiKeys.address: params.address.trim(),
      ApiKeys.nationalId: params.nationalId,
      ApiKeys.notes: params.notes,
      ApiKeys.isActive: true,
      ApiKeys.createdAt: now.toIso8601String(),
      ApiKeys.machinesCount: 0,
      ApiKeys.totalPaid: 0,
    };

    await cachedMerchantsDao.upsertOne(optimisticJson);
    await syncQueueService.enqueue(
      SyncQueueItem(
        clientUuid: clientUuid,
        type: SyncOperationType.createMerchant,
        payload: <String, dynamic>{...params.toJson(), ApiKeys.clientUuid: clientUuid},
        createdAt: now,
        occurredAt: now,
        status: SyncItemStatus.pending,
      ),
    );

    syncCoordinator.notifyChange();
    unawaited(syncCoordinator.flush());

    return Right(MerchantResponseModel.fromJson(optimisticJson).toEntity());
  }

  @override
  Future<Either<ServerFailure, MerchantEntity>> updateMerchant({
    required String id,
    required UpdateMerchantParams params,
  }) {
    return _guard('updateMerchant', () async {
      final Response<dynamic> response = await apiService
          .client()
          .patch<dynamic>(WebConstant.merchant(id), data: params.toJson());

      return MerchantResponseModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, Unit>> deactivateMerchant({
    required String id,
    String? reason,
  }) {
    return _guard('deactivateMerchant', () async {
      final String? trimmed = reason?.trim();

      await apiService.client().patch<dynamic>(
        WebConstant.merchantDeactivate(id),
        data: <String, dynamic>{
          if (trimmed != null && trimmed.isNotEmpty) ApiKeys.reason: trimmed,
        },
      );

      return unit;
    });
  }

  /// The second of the app's offline-capable writes tied to a merchant
  /// (`10`): starting a plan is a record, not money moving, so it can be
  /// taken standing in the shop with no connection the same way registering
  /// the merchant itself can. Collecting a payment is not offered offline —
  /// see `collectSubscription`.
  @override
  Future<Either<ServerFailure, SubscriptionEntity>> createSubscription({
    required String merchantId,
    required CreateSubscriptionParams params,
  }) async {
    if (!await networkInfo.isConnected) {
      return _queueCreateSubscription(merchantId, params);
    }

    return _guard('createSubscription', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(
            WebConstant.merchantSubscriptions(merchantId),
            data: params.toJson(),
          );

      return SubscriptionResponseModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  /// No local cache backs subscriptions (`fetchSubscriptions` has no offline
  /// read path), so unlike a queued merchant this optimistic row is not
  /// written anywhere the merchant-detail screen's next load will see — it
  /// is returned once, to confirm the plan was accepted, and the real one
  /// appears only once this syncs. It stays visible meanwhile in the sync
  /// queue screen like every other pending write.
  Future<Either<ServerFailure, SubscriptionEntity>> _queueCreateSubscription(
    String merchantId,
    CreateSubscriptionParams params,
  ) async {
    final String clientUuid = const Uuid().v4();
    final DateTime now = DateTime.now().toUtc();

    await syncQueueService.enqueue(
      SyncQueueItem(
        clientUuid: clientUuid,
        type: SyncOperationType.createSubscription,
        payload: <String, dynamic>{
          ApiKeys.merchantId: merchantId,
          ...params.toJson(),
          ApiKeys.clientUuid: clientUuid,
        },
        createdAt: now,
        occurredAt: now,
        status: SyncItemStatus.pending,
      ),
    );

    syncCoordinator.notifyChange();
    unawaited(syncCoordinator.flush());

    return Right(
      SubscriptionEntity(
        id: clientUuid,
        planType: params.planType,
        amount: params.amount,
        startDate: params.startDate,
        endDate: params.endDate,
        machineId: params.machineId,
        notes: params.notes,
        isActive: true,
      ),
    );
  }

  @override
  Future<Either<ServerFailure, SubscriptionEntity>> updateSubscription({
    required String subscriptionId,
    required UpdateSubscriptionParams params,
  }) {
    return _guard('updateSubscription', () async {
      final Response<dynamic> response = await apiService
          .client()
          .patch<dynamic>(
            WebConstant.subscription(subscriptionId),
            data: params.toJson(),
          );

      return SubscriptionResponseModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, SubscriptionEntity>> collectSubscription({
    required String subscriptionId,
    required CollectSubscriptionParams params,
  }) {
    return _guard('collectSubscription', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(
            WebConstant.subscriptionCollect(subscriptionId),
            data: params.toJson(),
          );

      return SubscriptionResponseModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, List<BranchEntity>>> fetchBranches() {
    return _guard('fetchBranches', () async {
      final List<Map<String, dynamic>> rows = await PaginatedFetch.all(
        client: apiService.client(),
        path: WebConstant.branches,
      );

      return rows
          .map(
            (Map<String, dynamic> json) =>
                BranchModel.fromJson(json).toEntity(),
          )
          .toList(growable: false);
    });
  }

  /// Every call shares the same shape: refuse offline, run, translate the two
  /// failure modes. Repeating this per method is how one of them ends up
  /// swallowing an exception.
  Future<Either<ServerFailure, T>> _guard<T>(
    String label,
    Future<T> Function() run,
  ) async {
    try {
      if (!await networkInfo.isConnected) {
        return Left(OfflineFailure());
      }

      return Right(await run());
    } on PaginatedFetchCapException catch (error, stackTrace) {
      printDebug(
        message: 'merchants repo $label page cap: $error',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.paginationListTooLarge.tr()));
    } on DioException catch (error, stackTrace) {
      printDebug(
        message: 'merchants repo $label dio exception: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'merchants repo $label catch: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
    }
  }

  static Map<String, dynamic> _body(dynamic raw) {
    return raw is Map<String, dynamic> ? raw : const <String, dynamic>{};
  }

  static Map<String, dynamic> _data(dynamic raw) {
    final dynamic data = _body(raw)[ApiKeys.data];
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// Paginated endpoints return `data` as a bare array with the paging in
  /// `meta`; the unpaginated ones wrap it as `data.items`. Accept both.
  static List<Map<String, dynamic>> _list(dynamic raw) {
    if (raw is List) {
      return raw.whereType<Map<String, dynamic>>().toList(growable: false);
    }

    if (raw is Map<String, dynamic> && raw[ApiKeys.items] is List) {
      return (raw[ApiKeys.items] as List)
          .whereType<Map<String, dynamic>>()
          .toList(growable: false);
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
