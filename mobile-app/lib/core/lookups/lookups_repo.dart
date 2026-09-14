import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/paginated_fetch.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/resources/debug_print.dart';

/// The reference tables behind the pickers: payment methods, violation types.
///
/// These change once a year at most, so the first fetch is held for the rest of
/// the session — a rep opening the collect sheet five times on his round should
/// pay for one request, not five. The cache is per-instance and the locator
/// registers this as a singleton, so switching language mid-session is the one
/// case that needs [clear].
class LookupsRepo {
  LookupsRepo({required this.apiService});

  final ApiService apiService;

  final Map<String, List<LookupEntity>> _cache = <String, List<LookupEntity>>{};

  /// Seeded catalogues stay a bare array (capped at 100 server-side). Suppliers
  /// is a real offset-paginated table, so it must walk pages rather than take
  /// the first 20.
  static const Set<String> _pagedPaths = <String>{
    WebConstant.financeSuppliers,
  };

  Future<Either<ServerFailure, List<LookupEntity>>> paymentMethods() {
    return _fetch(WebConstant.paymentMethods, LookupEntity.fromJson);
  }

  Future<Either<ServerFailure, List<LookupEntity>>> violationTypes() {
    return _fetch(WebConstant.violationTypes, ViolationTypeEntity.fromJson);
  }

  Future<Either<ServerFailure, List<LookupEntity>>> maintenanceLocations() {
    return _fetch(WebConstant.maintenanceLocations, LookupEntity.fromJson);
  }

  Future<Either<ServerFailure, List<LookupEntity>>> decommissionReasons() {
    return _fetch(WebConstant.decommissionReasons, LookupEntity.fromJson);
  }

  /// The same `/suppliers` table finance's transaction form reads — a
  /// maintenance invoice names a supplier exactly the way an expense does.
  Future<Either<ServerFailure, List<LookupEntity>>> suppliers() {
    return _fetch(WebConstant.financeSuppliers, LookupEntity.fromJson);
  }

  /// Called when the locale changes: every cached `name` is in the old
  /// language.
  void clear() => _cache.clear();

  Future<Either<ServerFailure, List<LookupEntity>>> _fetch(
    String path,
    LookupEntity Function(Map<String, dynamic>) parse,
  ) async {
    final List<LookupEntity>? cached = _cache[path];
    if (cached != null) {
      return Right(cached);
    }

    try {
      final List<Map<String, dynamic>> raw = _pagedPaths.contains(path)
          ? await PaginatedFetch.all(client: apiService.client(), path: path)
          : _list(
              (await apiService.client().get<dynamic>(path)).data,
            );

      final List<LookupEntity> rows = raw
          .map(parse)
          .where((LookupEntity row) => row.isActive)
          .toList(growable: false);

      _cache[path] = rows;
      return Right(rows);
    } on PaginatedFetchCapException catch (error, stackTrace) {
      printDebug(
        message: 'lookups repo $path hit the page cap: $error',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.paginationListTooLarge.tr()));
    } on DioException catch (error, stackTrace) {
      printDebug(
        message: 'lookups repo $path dio exception: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'lookups repo $path catch: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
    }
  }

  /// Unpaged lookups answer with a bare array under `data`.
  static List<Map<String, dynamic>> _list(dynamic raw) {
    final dynamic body = raw is Map<String, dynamic>
        ? raw[ApiKeys.data]
        : const <dynamic>[];

    return body is List
        ? body.whereType<Map<String, dynamic>>().toList(growable: false)
        : const <Map<String, dynamic>>[];
  }
}
