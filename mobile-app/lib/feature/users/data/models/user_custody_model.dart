import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/feature/users/domain/entities/user_custody_entity.dart';

UserCustodyEntity userCustodyFromJson(Map<String, dynamic> json) {
  final summary = _map(json['summary']);
  final rows = json['machines'] is List ? json['machines'] as List : const [];
  final meta = json[ApiKeys.machinesMeta];
  return UserCustodyEntity(
    summary: UserCustodySummary(
      totalMachines: _int(summary['totalMachines']),
      withMerchants: _int(summary['withMerchants']),
      inHand: _int(summary['inHand']),
      openViolations: _int(summary['openViolations']),
    ),
    machines: rows.whereType<Map<String, dynamic>>().map((row) {
      final merchant = _map(row['merchant']);
      return UserCustodyMachine(
        id: row['id']?.toString() ?? '',
        serial: row['serial']?.toString() ?? '',
        model: row['model']?.toString() ?? '',
        status: row['status']?.toString() ?? '',
        heldSince: DateTime.tryParse(row['heldSince']?.toString() ?? '') ??
            DateTime(1970),
        merchantId: merchant['id']?.toString(),
        merchantName: merchant['shopName']?.toString(),
      );
    }).toList(growable: false),
    machinesMeta: meta is Map<String, dynamic>
        ? PaginationMetaModel.fromJson(meta)
        : PaginationMetaModel.empty,
  );
}

Map<String, dynamic> _map(Object? value) =>
    value is Map<String, dynamic> ? value : const <String, dynamic>{};
int _int(Object? value) => value is num ? value.toInt() : 0;
