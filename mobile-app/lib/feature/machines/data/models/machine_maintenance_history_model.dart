import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/feature/machines/domain/entities/machine_maintenance_history.dart';

/// `GET /machines/:id/maintenance-history`.
class MachineMaintenanceHistoryModel {
  const MachineMaintenanceHistoryModel({required this.entity});

  final MachineMaintenanceHistory entity;

  factory MachineMaintenanceHistoryModel.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> totals = _object(json[ApiKeys.totals]);
    final List<dynamic> orders = json[ApiKeys.orders] is List
        ? json[ApiKeys.orders] as List<dynamic>
        : const <dynamic>[];

    return MachineMaintenanceHistoryModel(
      entity: MachineMaintenanceHistory(
        machineId: json[ApiKeys.machineId]?.toString() ?? '',
        serial: json[ApiKeys.serial] as String? ?? '',
        totals: MaintenanceHistoryTotals(
          orders: _int(totals[ApiKeys.orders]),
          totalCost: _double(totals[ApiKeys.totalCost]) ?? 0,
          freeUnderWarranty: _int(totals[ApiKeys.freeUnderWarranty]),
          chargedToCompany: _int(totals[ApiKeys.chargedToCompany]),
          chargedToRepresentative: _int(
            totals[ApiKeys.chargedToRepresentative],
          ),
          chargedToMerchant: _int(totals[ApiKeys.chargedToMerchant]),
          chargedToFactory: _int(totals[ApiKeys.chargedToFactory]),
        ),
        orders: orders
            .whereType<Map<String, dynamic>>()
            .map(_orderFromJson)
            .toList(growable: false),
        ordersMeta: json[ApiKeys.ordersMeta] is Map<String, dynamic>
            ? PaginationMetaModel.fromJson(
                json[ApiKeys.ordersMeta] as Map<String, dynamic>,
              )
            : PaginationMetaModel.empty,
      ),
    );
  }

  MachineMaintenanceHistory toEntity() => entity;

  static MaintenanceOrderSummary _orderFromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> location = _object(json[ApiKeys.location]);
    final Map<String, dynamic> branch = _object(json[ApiKeys.branch]);

    return MaintenanceOrderSummary(
      id: json[ApiKeys.id]?.toString() ?? '',
      referenceNo: json[ApiKeys.referenceNo] as String? ?? '',
      locationName: location[ApiKeys.name] as String? ?? '',
      status: MaintenanceOrderStatus.fromJson(json[ApiKeys.status] as String?),
      result: json[ApiKeys.result] == null
          ? null
          : MaintenanceOrderResult.fromJson(json[ApiKeys.result] as String?),
      sentAt: _dateOrNow(json[ApiKeys.sentAt]),
      returnedAt: _dateOrNull(json[ApiKeys.returnedAt]),
      cost: _double(json[ApiKeys.cost]),
      isFreeUnderWarranty: json[ApiKeys.isFreeUnderWarranty] as bool? ?? false,
      responsibleParty: json[ApiKeys.responsibleParty] == null
          ? null
          : MaintenanceResponsibleParty.fromJson(
              json[ApiKeys.responsibleParty] as String?,
            ),
      branchName: branch.isEmpty ? null : branch[ApiKeys.name] as String?,
    );
  }

  static Map<String, dynamic> _object(dynamic raw) =>
      raw is Map<String, dynamic> ? raw : const <String, dynamic>{};

  static double? _double(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  static int _int(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  static DateTime _dateOrNow(dynamic value) {
    if (value is String) {
      return DateTime.tryParse(value)?.toLocal() ?? DateTime.now();
    }
    return DateTime.now();
  }

  static DateTime? _dateOrNull(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value)?.toLocal();
  }
}
