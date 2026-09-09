import 'package:dio/dio.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/services/sync/sync_operation_type.dart';

/// The parsed shape of `/sync/bootstrap` and `/sync/delta` — kept as raw JSON
/// per collection rather than typed entities. Each collection is written
/// straight into the matching DAO, which already knows how to turn that exact
/// JSON shape into an entity (the same parser the REST list endpoints use) —
/// duplicating that parsing here would be a second copy to keep in sync.
class SyncPullResult {
  const SyncPullResult({
    required this.serverTime,
    required this.schemaVersion,
    required this.lookups,
    required this.branches,
    required this.myMachines,
    required this.myMerchants,
    required this.pendingTransfers,
    required this.permissions,
    this.deletedMachineIds = const <String>[],
    this.deletedMerchantIds = const <String>[],
    this.deletedTransferIds = const <String>[],
    this.nextSince,
  });

  final String serverTime;
  final int schemaVersion;

  /// Keyed by [SyncLookupCategory]. Branches are a sibling field, not a key
  /// here, because they cache into their own `cached_branches` table rather
  /// than the generic `cached_lookups` bucket.
  final Map<String, List<Map<String, dynamic>>> lookups;
  final List<Map<String, dynamic>> branches;
  final List<Map<String, dynamic>> myMachines;
  final List<Map<String, dynamic>> myMerchants;
  final List<Map<String, dynamic>> pendingTransfers;
  final List<String> permissions;

  final List<String> deletedMachineIds;
  final List<String> deletedMerchantIds;
  final List<String> deletedTransferIds;

  /// `null` for a bootstrap; always present on a delta — the cursor for the
  /// next call. Never the device clock (`07`).
  final String? nextSince;
}

/// The JSON keys `SyncLookupsResponse` (backend) nests its seven lists under —
/// used both to read the bootstrap/delta payload and as the `category` key in
/// `cached_lookups`.
abstract class SyncLookupCategory {
  static const String machineTypes = 'machineTypes';
  static const String machineModels = 'machineModels';
  static const String paymentMethods = 'paymentMethods';
  static const String violationTypes = 'violationTypes';
  static const String maintenanceLocations = 'maintenanceLocations';
  static const String decommissionReasons = 'decommissionReasons';
  static const String financeCategories = 'financeCategories';
  static const String branches = 'branches';

  static const List<String> all = <String>[
    machineTypes,
    machineModels,
    paymentMethods,
    violationTypes,
    maintenanceLocations,
    decommissionReasons,
    financeCategories,
  ];
}

/// One operation's answer from `POST /sync/batch` (`SyncOperationResultResponse`).
class SyncBatchItemResult {
  const SyncBatchItemResult({
    required this.clientUuid,
    required this.type,
    required this.status,
    this.serverId,
    this.errorCode,
    this.errorMessage,
    this.resolution,
    this.serverState,
  });

  final String clientUuid;
  final SyncOperationType? type;
  final SyncBatchOutcome status;
  final String? serverId;
  final String? errorCode;
  final String? errorMessage;
  final SyncResolution? resolution;
  final Map<String, dynamic>? serverState;

  static SyncBatchItemResult fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? error = json['error'] as Map<String, dynamic>?;

    return SyncBatchItemResult(
      clientUuid: json['clientUuid'] as String? ?? '',
      type: SyncOperationType.fromJson(json['type'] as String?),
      status: SyncBatchOutcome.fromJson(json['status'] as String?) ?? SyncBatchOutcome.failed,
      serverId: json['serverId'] as String?,
      errorCode: error?['code'] as String?,
      errorMessage: error?['message'] as String?,
      resolution: SyncResolution.fromJson(json['resolution'] as String?),
      serverState: json['serverState'] as Map<String, dynamic>?,
    );
  }
}

/// Talks to `sync/status`, `sync/bootstrap`, `sync/delta`, `sync/batch`
/// (`WebConstant`, already declared — this is the first consumer of them).
class SyncApi {
  SyncApi({required this.apiService});

  final ApiService apiService;

  Future<({String serverTime, int schemaVersion})> status() async {
    final Response<dynamic> response =
        await apiService.client().get<dynamic>(WebConstant.syncStatus);
    final Map<String, dynamic> data = _data(response.data);
    return (
      serverTime: data['serverTime'] as String? ?? DateTime.now().toUtc().toIso8601String(),
      schemaVersion: (data['schemaVersion'] as num?)?.toInt() ?? 0,
    );
  }

  Future<SyncPullResult> bootstrap() async {
    final Response<dynamic> response =
        await apiService.client().get<dynamic>(WebConstant.syncBootstrap);
    return parsePull(_data(response.data));
  }

  Future<SyncPullResult> delta(String since) async {
    final Response<dynamic> response = await apiService.client().get<dynamic>(
      WebConstant.syncDelta,
      queryParameters: <String, dynamic>{'since': since},
    );
    return parsePull(_data(response.data));
  }

  /// Up to 50 operations. The batch itself never throws for an individual
  /// operation's failure — only a transport-level problem (offline, 5xx) does.
  Future<List<SyncBatchItemResult>> pushBatch(
    List<Map<String, dynamic>> operations,
  ) async {
    final Response<dynamic> response = await apiService.client().post<dynamic>(
      WebConstant.syncBatch,
      data: <String, dynamic>{'operations': operations},
    );

    final Map<String, dynamic> data = _data(response.data);
    final List<dynamic> results = data['results'] as List<dynamic>? ?? <dynamic>[];

    return results
        .whereType<Map<String, dynamic>>()
        .map(SyncBatchItemResult.fromJson)
        .toList(growable: false);
  }

  /// Exposed as a static, pure function (no Dio involved) so a test can feed
  /// it a hand-built envelope the way the contract-parsing tests do for every
  /// other feature's `*ResponseModel.fromJson`.
  static SyncPullResult parsePull(Map<String, dynamic> data) {
    final Map<String, dynamic> lookupsJson = _map(data['lookups']);
    final Map<String, dynamic>? deleted = _mapOrNull(data['deleted']);

    return SyncPullResult(
      serverTime: data['serverTime'] as String? ?? DateTime.now().toUtc().toIso8601String(),
      schemaVersion: (data['schemaVersion'] as num?)?.toInt() ?? 0,
      lookups: <String, List<Map<String, dynamic>>>{
        for (final String category in SyncLookupCategory.all)
          category: _list(lookupsJson[category]),
      },
      branches: _list(lookupsJson[SyncLookupCategory.branches]),
      myMachines: _list(data['myMachines']),
      myMerchants: _list(data['myMerchants']),
      pendingTransfers: _list(data['pendingTransfers']),
      permissions: (data['permissions'] as List<dynamic>? ?? <dynamic>[])
          .whereType<String>()
          .toList(growable: false),
      deletedMachineIds: _strings(deleted?['machines']),
      deletedMerchantIds: _strings(deleted?['merchants']),
      deletedTransferIds: _strings(deleted?['transfers']),
      nextSince: data['nextSince'] as String?,
    );
  }

  static Map<String, dynamic> _map(dynamic raw) =>
      raw is Map<String, dynamic> ? raw : const <String, dynamic>{};

  static Map<String, dynamic>? _mapOrNull(dynamic raw) => raw is Map<String, dynamic> ? raw : null;

  static Map<String, dynamic> _body(dynamic raw) =>
      raw is Map<String, dynamic> ? raw : const <String, dynamic>{};

  static Map<String, dynamic> _data(dynamic raw) {
    final dynamic data = _body(raw)['data'];
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  static List<Map<String, dynamic>> _list(dynamic raw) {
    if (raw is! List) return const <Map<String, dynamic>>[];
    return raw.whereType<Map<String, dynamic>>().toList(growable: false);
  }

  static List<String> _strings(dynamic raw) {
    if (raw is! List) return const <String>[];
    return raw.whereType<String>().toList(growable: false);
  }
}
