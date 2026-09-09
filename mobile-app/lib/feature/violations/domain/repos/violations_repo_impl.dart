import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/feature/violations/data/models/violation_response_model.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/params/violation_action_params.dart';
import 'package:machinery/feature/violations/domain/params/violations_query_params.dart';
import 'package:machinery/feature/violations/domain/repos/violations_repo.dart';

class ViolationsRepoImpl implements ViolationsRepo {
  ViolationsRepoImpl({required this.apiService, required this.networkInfo});

  final ApiService apiService;
  final NetworkInfo networkInfo;

  @override
  Future<Either<ServerFailure, ViolationsPage>> fetchViolations({
    required ViolationsQueryParams params,
  }) {
    return _guard('fetchViolations', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.violations,
        queryParameters: params.toQuery(),
      );

      final Map<String, dynamic> body = _body(response.data);

      return ViolationsPage(
        violations: _list(body[ApiKeys.data])
            .map(
              (Map<String, dynamic> json) =>
                  ViolationResponseModel.fromJson(json).toEntity(),
            )
            .toList(growable: false),
        meta: _metaOf(body),
      );
    });
  }

  @override
  Future<Either<ServerFailure, ViolationEntity>> fetchViolation({
    required String id,
  }) {
    return _guard('fetchViolation', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.violation(id),
      );

      return ViolationResponseModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, ViolationEntity>> createViolation({
    required CreateViolationParams params,
  }) {
    return _guard('createViolation', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(WebConstant.violations, data: params.toJson());

      return ViolationResponseModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, ViolationEntity>> updateViolation({
    required String id,
    required UpdateViolationParams params,
  }) {
    return _guard('updateViolation', () async {
      final Response<dynamic> response = await apiService
          .client()
          .patch<dynamic>(WebConstant.violation(id), data: params.toJson());

      return ViolationResponseModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, ViolationEntity>> acknowledge({
    required String id,
  }) {
    return _guard('acknowledge', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(WebConstant.violationAcknowledge(id));

      return ViolationResponseModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, ViolationEntity>> charge({
    required String id,
    required ChargeViolationParams params,
  }) {
    return _guard('charge', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(
            WebConstant.violationCharge(id),
            data: params.toJson(),
          );

      return ViolationResponseModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, ViolationEntity>> waive({
    required String id,
    required WaiveViolationParams params,
  }) {
    return _guard('waive', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(WebConstant.violationWaive(id), data: params.toJson());

      return ViolationResponseModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, ViolationSummary>> fetchSummary({
    required String userId,
  }) {
    return _guard('fetchSummary', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.userViolationsSummary(userId),
      );

      return ViolationSummaryModel.fromJson(_data(response.data)).toEntity();
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
        message: 'violations repo $label dio exception: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'violations repo $label catch: ${error.toString()}',
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
