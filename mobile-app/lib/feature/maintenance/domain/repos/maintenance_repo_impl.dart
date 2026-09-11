import 'dart:typed_data';

import 'package:crypto/crypto.dart';
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
import 'package:machinery/feature/maintenance/data/models/maintenance_response_model.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/domain/repos/maintenance_repo.dart';

class MaintenanceRepoImpl implements MaintenanceRepo {
  MaintenanceRepoImpl({required this.apiService, required this.networkInfo});

  final ApiService apiService;
  final NetworkInfo networkInfo;

  static const String _signaturePurpose = 'SIGNATURE';
  static const String _invoicePurpose = 'INVOICE';

  @override
  Future<Either<ServerFailure, String>> uploadSignature({
    required Uint8List png,
  }) {
    return _guard(
      'uploadSignature',
      () => _upload(png, _signaturePurpose, 'image/png'),
    );
  }

  @override
  Future<Either<ServerFailure, String>> uploadInvoice({
    required Uint8List jpeg,
  }) {
    return _guard(
      'uploadInvoice',
      () => _upload(jpeg, _invoicePurpose, 'image/jpeg'),
    );
  }

  /// Reserve a key, PUT the bytes straight at storage, then confirm — the same
  /// presign/PUT/confirm handshake transfers use, copied once rather than
  /// reached into `TransfersRepo` (see the doc comment on `MaintenanceRepo`).
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

  @override
  Future<Either<ServerFailure, MaintenanceOrdersPage>> fetchOrders({
    required MaintenanceOrdersQueryParams params,
  }) {
    return _guard('fetchOrders', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.maintenanceOrders,
        queryParameters: params.toQuery(),
      );

      final Map<String, dynamic> body = _body(response.data);

      return MaintenanceOrdersPage(
        orders: _list(body[ApiKeys.data])
            .map(
              (Map<String, dynamic> json) =>
                  MaintenanceOrderResponseModel.fromJson(json).toEntity(),
            )
            .toList(growable: false),
        meta: _metaOf(body),
      );
    });
  }

  @override
  Future<Either<ServerFailure, MaintenanceOrderEntity>> fetchOrder({
    required String id,
  }) {
    return _guard('fetchOrder', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.maintenanceOrder(id),
      );

      return MaintenanceOrderResponseModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, MaintenanceOrderEntity>> createOrder({
    required CreateMaintenanceOrderParams params,
  }) {
    return _guard('createOrder', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(WebConstant.maintenanceOrders, data: params.toJson());

      return MaintenanceOrderResponseModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, MaintenanceOrderEntity>> updateOrder({
    required String id,
    required UpdateMaintenanceOrderParams params,
  }) {
    return _guard('updateOrder', () async {
      final Response<dynamic> response = await apiService
          .client()
          .patch<dynamic>(
            WebConstant.maintenanceOrder(id),
            data: params.toJson(),
          );

      return MaintenanceOrderResponseModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, MaintenanceOrderEntity>> sendOrder({
    required String id,
    required MaintenanceHandoverParams params,
  }) {
    return _guard('sendOrder', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(
            WebConstant.maintenanceOrderSend(id),
            data: params.toJson(),
          );

      return MaintenanceOrderResponseModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, MaintenanceOrderEntity>> receiveOrder({
    required String id,
    required MaintenanceHandoverParams params,
  }) {
    return _guard('receiveOrder', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(
            WebConstant.maintenanceOrderReceive(id),
            data: params.toJson(),
          );

      return MaintenanceOrderResponseModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, MaintenanceOrderEntity>> cancelOrder({
    required String id,
    required CancelMaintenanceOrderParams params,
  }) {
    return _guard('cancelOrder', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(
            WebConstant.maintenanceOrderCancel(id),
            data: params.toJson(),
          );

      return MaintenanceOrderResponseModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, MaintenanceOrderEntity>> closeOrder({
    required String id,
    required CloseMaintenanceOrderParams params,
  }) {
    return _guard('closeOrder', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(
            WebConstant.maintenanceOrderClose(id),
            data: params.toJson(),
          );

      return MaintenanceOrderResponseModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, MachineReplacedEntity>> replaceMachine({
    required String machineId,
    required ReplacementMachineParams params,
  }) {
    return _guard('replaceMachine', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(
            WebConstant.machineReplace(machineId),
            data: params.toJson(),
          );

      return MachineReplacedResponseModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, ReplacementsPage>> fetchReplacements({
    String? machineId,
    String? maintenanceOrderId,
  }) {
    return _guard('fetchReplacements', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.replacements,
        queryParameters: <String, dynamic>{
          ApiKeys.machineId: ?machineId,
          ApiKeys.maintenanceOrderId: ?maintenanceOrderId,
        },
      );

      final Map<String, dynamic> body = _body(response.data);

      return ReplacementsPage(
        replacements: _list(body[ApiKeys.data])
            .map(
              (Map<String, dynamic> json) =>
                  ReplacementResponseModel.fromJson(json).toEntity(),
            )
            .toList(growable: false),
        meta: _metaOf(body),
      );
    });
  }

  @override
  Future<Either<ServerFailure, DecommissionEntity>> fetchDecommission({
    required String machineId,
  }) {
    return _guard('fetchDecommission', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.machineDecommission(machineId),
      );

      return DecommissionResponseModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, MachineCostSummary>> fetchCostSummary({
    required String machineId,
  }) {
    return _guard('fetchCostSummary', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.machineCostSummary(machineId),
      );
      final Map<String, dynamic> json = _data(response.data);

      return MachineCostSummary(
        purchasePrice: _double(json[ApiKeys.purchasePrice]),
        totalRepairCost: _double(json[ApiKeys.totalRepairCost]) ?? 0,
        repairCount: _int(json[ApiKeys.repairCount]),
        costToValueRatio: _double(json[ApiKeys.costToValueRatio]),
        ageMonths: _int(json[ApiKeys.ageMonths]),
        isInChain: json[ApiKeys.isInChain] as bool? ?? false,
        chainLength: _int(json[ApiKeys.chainLength], fallback: 1),
      );
    });
  }

  @override
  Future<Either<ServerFailure, DecommissionEntity>> decommissionMachine({
    required String machineId,
    required DecommissionMachineParams params,
  }) {
    return _guard('decommissionMachine', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(
            WebConstant.machineDecommission(machineId),
            data: params.toJson(),
          );

      return DecommissionResponseModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, Unit>> revertDecommission({
    required String machineId,
    required RevertDecommissionParams params,
  }) {
    return _guard('revertDecommission', () async {
      await apiService.client().post<dynamic>(
        WebConstant.machineDecommissionRevert(machineId),
        data: params.toJson(),
      );

      return unit;
    });
  }

  @override
  Future<Either<ServerFailure, DecommissionsPage>> fetchDecommissions({
    required DecommissionsQueryParams params,
  }) {
    return _guard('fetchDecommissions', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.decommissions,
        queryParameters: params.toQuery(),
      );

      final Map<String, dynamic> body = _body(response.data);

      return DecommissionsPage(
        decommissions: _list(body[ApiKeys.data])
            .map(
              (Map<String, dynamic> json) =>
                  DecommissionResponseModel.fromJson(json).toEntity(),
            )
            .toList(growable: false),
        meta: _metaOf(body),
      );
    });
  }

  @override
  Future<Either<ServerFailure, DecommissionCandidatesPage>>
  fetchDecommissionCandidates({
    required DecommissionCandidatesQueryParams params,
  }) {
    return _guard('fetchDecommissionCandidates', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.machinesDecommissionCandidates,
        queryParameters: params.toQuery(),
      );

      final Map<String, dynamic> body = _body(response.data);

      return DecommissionCandidatesPage(
        candidates: _list(body[ApiKeys.data])
            .map(
              (Map<String, dynamic> json) =>
                  DecommissionCandidateResponseModel.fromJson(json).toEntity(),
            )
            .toList(growable: false),
        meta: _metaOf(body),
      );
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
        message: 'maintenance repo $label dio exception: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'maintenance repo $label catch: ${error.toString()}',
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

  static double? _double(dynamic value) {
    if (value is num) return value.toDouble();
    return value is String ? double.tryParse(value) : null;
  }

  static int _int(dynamic value, {int fallback = 0}) {
    if (value is num) return value.toInt();
    return value is String ? int.tryParse(value) ?? fallback : fallback;
  }

  static PaginationMetaModel _metaOf(Map<String, dynamic> body) {
    final dynamic meta = body[ApiKeys.meta];
    return PaginationMetaModel.fromJson(
      meta is Map<String, dynamic> ? meta : const <String, dynamic>{},
    );
  }
}
