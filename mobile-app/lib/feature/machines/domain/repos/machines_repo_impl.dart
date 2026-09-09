import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/local_db/daos/cached_machines_dao.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/feature/machines/data/models/machine_catalogue_model.dart';
import 'package:machinery/feature/machines/data/models/machine_maintenance_history_model.dart';
import 'package:machinery/feature/machines/data/models/machine_response_model.dart';
import 'package:machinery/feature/machines/data/models/machine_timeline_event_model.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_lookup_result.dart';
import 'package:machinery/feature/machines/domain/entities/machine_maintenance_history.dart';
import 'package:machinery/feature/machines/domain/params/machine_form_params.dart';
import 'package:machinery/feature/machines/domain/params/machines_query_params.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';
import 'package:machinery/feature/users/data/models/branch_model.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

class MachinesRepoImpl implements MachinesRepo {
  MachinesRepoImpl({
    required this.apiService,
    required this.networkInfo,
    required this.cachedMachinesDao,
  });

  final ApiService apiService;
  final NetworkInfo networkInfo;
  final CachedMachinesDao cachedMachinesDao;

  /// Local-first (`6.2`): online, this behaves exactly as before — a network
  /// list, written through to the cache so it is there the next time there
  /// is no connection. Offline, it falls back to the cache rather than
  /// failing outright; the trade-off is that only `search` (a substring over
  /// the cached `serial`) still filters — the richer server-side filter set
  /// (status/type/branch/warranty/repair-cost) has nothing to run against
  /// once there is no request to attach it to, so those are silently not
  /// applied rather than pretending to and returning the wrong machines.
  @override
  Future<Either<ServerFailure, MachinesPage>> fetchMachines({
    required MachinesQueryParams params,
  }) async {
    if (await networkInfo.isConnected) {
      try {
        final Response<dynamic> response = await apiService
            .client()
            .get<dynamic>(
              WebConstant.machines,
              queryParameters: params.toQuery(),
            );

        final Map<String, dynamic> body = _body(response.data);
        final List<Map<String, dynamic>> rows = _list(body[ApiKeys.data]);
        await cachedMachinesDao.upsertAll(rows);

        return Right(
          MachinesPage(
            machines: rows
                .map(
                  (Map<String, dynamic> json) =>
                      MachineResponseModel.fromJson(json).toEntity(),
                )
                .toList(growable: false),
            meta: _metaOf(body),
          ),
        );
      } on DioException catch (error, stackTrace) {
        printDebug(
          message:
              'machines repo fetchMachines dio exception: ${error.message}',
          stackTrace: stackTrace,
        );
        return _machinesFromCache(params);
      } catch (error, stackTrace) {
        printDebug(
          message: 'machines repo fetchMachines catch: $error',
          stackTrace: stackTrace,
        );
        return _machinesFromCache(params);
      }
    }

    return _machinesFromCache(params);
  }

  Future<Either<ServerFailure, MachinesPage>> _machinesFromCache(
    MachinesQueryParams params,
  ) async {
    final List<MachineEntity> machines = await cachedMachinesDao.search(
      query: params.search,
    );
    return Right(
      MachinesPage(
        machines: machines,
        meta: PaginationMetaModel(
          page: 1,
          limit: machines.length,
          total: machines.length,
          totalPages: 1,
          hasNext: false,
        ),
      ),
    );
  }

  @override
  Future<Either<ServerFailure, MachineEntity>> fetchMachine({
    required String id,
  }) async {
    if (await networkInfo.isConnected) {
      try {
        final Response<dynamic> response = await apiService
            .client()
            .get<dynamic>(WebConstant.machine(id));
        final Map<String, dynamic> json = _data(response.data);
        await cachedMachinesDao.upsertAll(<Map<String, dynamic>>[json]);
        return Right(MachineResponseModel.fromJson(json).toEntity());
      } on DioException catch (error, stackTrace) {
        printDebug(
          message: 'machines repo fetchMachine dio exception: ${error.message}',
          stackTrace: stackTrace,
        );
        return _machineFromCache(id);
      } catch (error, stackTrace) {
        printDebug(
          message: 'machines repo fetchMachine catch: $error',
          stackTrace: stackTrace,
        );
        return _machineFromCache(id);
      }
    }

    return _machineFromCache(id);
  }

  Future<Either<ServerFailure, MachineEntity>> _machineFromCache(
    String id,
  ) async {
    final MachineEntity? cached = await cachedMachinesDao.findById(id);
    return cached == null ? Left(OfflineFailure()) : Right(cached);
  }

  @override
  Future<Either<ServerFailure, MachineLookupResult>> lookup({
    required String code,
  }) {
    return _guard('lookup', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.machinesLookup,
        queryParameters: <String, dynamic>{ApiKeys.code: code.trim()},
      );

      final Map<String, dynamic> data = _data(response.data);
      final dynamic rawMachine = data[ApiKeys.machine];

      return MachineLookupResult(
        matchedOn: ScannedSerialKind.fromJson(
          data[ApiKeys.matchedOn] as String?,
        ),
        machine: MachineResponseModel.fromJson(
          rawMachine is Map<String, dynamic>
              ? rawMachine
              : const <String, dynamic>{},
        ).toEntity(),
      );
    });
  }

  @override
  Future<Either<ServerFailure, MachineEntity>> createMachine({
    required CreateMachineParams params,
  }) {
    return _guard('createMachine', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(WebConstant.machines, data: params.toJson());

      return MachineResponseModel.fromJson(_data(response.data)).toEntity();
    });
  }

  /// Bypasses [_guard]: a 400 here carries a per-row detail list (`8.1`) that
  /// the generic parsing has no way to express, so this method does its own.
  @override
  Future<Either<ServerFailure, List<MachineEntity>>> bulkCreateMachines({
    required List<CreateMachineParams> rows,
  }) async {
    if (!await networkInfo.isConnected) {
      return Left(OfflineFailure());
    }

    try {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(
            WebConstant.machinesBulk,
            data: <String, dynamic>{
              ApiKeys.machines: rows
                  .map((CreateMachineParams row) => row.toJson())
                  .toList(growable: false),
            },
          );

      final Map<String, dynamic> data = _data(response.data);
      return Right(
        _list(data[ApiKeys.machines])
            .map(
              (Map<String, dynamic> json) =>
                  MachineResponseModel.fromJson(json).toEntity(),
            )
            .toList(growable: false),
      );
    } on DioException catch (error, stackTrace) {
      printDebug(
        message:
            'machines repo bulkCreateMachines dio exception: ${error.message}',
        stackTrace: stackTrace,
      );

      if (error.response?.statusCode == 400) {
        final ServerFailure generic = ServerFailure.fromDioException(error);
        return Left(
          BulkImportValidationFailure(
            generic.errorMessage,
            code: generic.code,
            statusCode: 400,
            problems: _bulkImportProblems(error.response?.data),
          ),
        );
      }

      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'machines repo bulkCreateMachines catch: $error',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
    }
  }

  /// Flattens `error.details` into `field: constraint` lines — each field
  /// already carries its own row index (`machines[2].serial`), so no further
  /// grouping is needed before showing them.
  static List<String> _bulkImportProblems(dynamic raw) {
    final dynamic details = raw is Map<String, dynamic>
        ? (raw[ApiKeys.error] is Map<String, dynamic>
              ? (raw[ApiKeys.error] as Map<String, dynamic>)[ApiKeys.details]
              : null)
        : null;

    if (details is! List) {
      return const <String>[];
    }

    return details
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

  @override
  Future<Either<ServerFailure, MachineEntity>> updateMachine({
    required String id,
    required UpdateMachineParams params,
  }) {
    return _guard('updateMachine', () async {
      final Response<dynamic> response = await apiService
          .client()
          .patch<dynamic>(WebConstant.machine(id), data: params.toJson());

      return MachineResponseModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, List<MachineEntity>>> fetchReplacementChain({
    required String id,
  }) {
    return _guard('fetchReplacementChain', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.machineReplacementChain(id),
      );

      return _list(_body(response.data)[ApiKeys.data])
          .map(
            (Map<String, dynamic> json) =>
                MachineResponseModel.fromJson(json).toEntity(),
          )
          .toList(growable: false);
    });
  }

  @override
  Future<Either<ServerFailure, MachineTimelinePage>> fetchTimeline({
    required String machineId,
    String? cursor,
  }) {
    return _guard('fetchTimeline', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.machineTimeline(machineId),
        queryParameters: <String, dynamic>{
          if (cursor != null && cursor.isNotEmpty) ApiKeys.cursor: cursor,
        },
      );

      final Map<String, dynamic> body = _body(response.data);
      return MachineTimelinePage(
        events: _list(body[ApiKeys.data])
            .map(
              (Map<String, dynamic> json) =>
                  MachineTimelineEventModel.fromJson(json).toEntity(),
            )
            .toList(growable: false),
        meta: _metaOf(body),
      );
    });
  }

  @override
  Future<Either<ServerFailure, MachineMaintenanceHistory>>
  fetchMaintenanceHistory({required String machineId}) {
    return _guard('fetchMaintenanceHistory', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.machineMaintenanceHistory(machineId),
      );

      return MachineMaintenanceHistoryModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, List<MachineTypeEntity>>> fetchMachineTypes() {
    return _guard('fetchMachineTypes', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.machineTypes,
      );

      return _list(_body(response.data)[ApiKeys.data])
          .map(
            (Map<String, dynamic> json) =>
                MachineTypeModel.fromJson(json).toEntity(),
          )
          .toList(growable: false);
    });
  }

  @override
  Future<Either<ServerFailure, List<MachineModelEntity>>> fetchMachineModels() {
    return _guard('fetchMachineModels', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.machineModels,
      );

      return _list(_body(response.data)[ApiKeys.data])
          .map(
            (Map<String, dynamic> json) =>
                MachineModelModel.fromJson(json).toEntity(),
          )
          .toList(growable: false);
    });
  }

  @override
  Future<Either<ServerFailure, List<BranchEntity>>> fetchBranches() {
    return _guard('fetchBranches', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.branches,
      );

      return _list(_body(response.data)[ApiKeys.data])
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
    } on DioException catch (error, stackTrace) {
      printDebug(
        message: 'machines repo $label dio exception: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'machines repo $label catch: ${error.toString()}',
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

  /// `GET /machines` returns `data` as a bare array with the paging in `meta`,
  /// but some list endpoints wrap it as `data.items`. Accept both.
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
