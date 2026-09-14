import 'package:equatable/equatable.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';

/// Mirrors the backend's `MaintenanceStatus` (`common/enums/operations.enum.ts`).
/// No `MaintenanceRepo` exists yet (`11`), so this lives here rather than in a
/// module of its own — the read-only history view is all section `8` owns.
enum MaintenanceOrderStatus {
  open('OPEN'),
  inProgress('IN_PROGRESS'),
  returned('RETURNED'),
  closed('CLOSED'),
  cancelled('CANCELLED'),
  unknown('UNKNOWN');

  const MaintenanceOrderStatus(this.value);

  final String value;

  static MaintenanceOrderStatus fromJson(String? raw) {
    return MaintenanceOrderStatus.values.firstWhere(
      (MaintenanceOrderStatus status) => status.value == raw,
      orElse: () => MaintenanceOrderStatus.unknown,
    );
  }
}

enum MaintenanceOrderResult {
  repaired('REPAIRED'),
  replaced('REPLACED'),
  unrepairable('UNREPAIRABLE'),
  unknown('UNKNOWN');

  const MaintenanceOrderResult(this.value);

  final String value;

  static MaintenanceOrderResult fromJson(String? raw) {
    return MaintenanceOrderResult.values.firstWhere(
      (MaintenanceOrderResult result) => result.value == raw,
      orElse: () => MaintenanceOrderResult.unknown,
    );
  }
}

enum MaintenanceResponsibleParty {
  company('COMPANY'),
  representative('REPRESENTATIVE'),
  merchant('MERCHANT'),
  factory('FACTORY'),
  unknown('UNKNOWN');

  const MaintenanceResponsibleParty(this.value);

  final String value;

  static MaintenanceResponsibleParty fromJson(String? raw) {
    return MaintenanceResponsibleParty.values.firstWhere(
      (MaintenanceResponsibleParty party) => party.value == raw,
      orElse: () => MaintenanceResponsibleParty.unknown,
    );
  }
}

class MaintenanceOrderSummary extends Equatable {
  const MaintenanceOrderSummary({
    required this.id,
    required this.referenceNo,
    required this.locationName,
    required this.status,
    required this.sentAt,
    required this.isFreeUnderWarranty,
    this.result,
    this.returnedAt,
    this.cost,
    this.responsibleParty,
    this.branchName,
  });

  final String id;
  final String referenceNo;
  final String locationName;
  final MaintenanceOrderStatus status;
  final MaintenanceOrderResult? result;
  final DateTime sentAt;
  final DateTime? returnedAt;
  final double? cost;
  final bool isFreeUnderWarranty;
  final MaintenanceResponsibleParty? responsibleParty;
  final String? branchName;

  @override
  List<Object?> get props => <Object?>[
    id,
    referenceNo,
    locationName,
    status,
    result,
    sentAt,
    returnedAt,
    cost,
    isFreeUnderWarranty,
    responsibleParty,
    branchName,
  ];
}

class MaintenanceHistoryTotals extends Equatable {
  const MaintenanceHistoryTotals({
    this.orders = 0,
    this.totalCost = 0,
    this.freeUnderWarranty = 0,
    this.chargedToCompany = 0,
    this.chargedToRepresentative = 0,
    this.chargedToMerchant = 0,
    this.chargedToFactory = 0,
  });

  final int orders;
  final double totalCost;
  final int freeUnderWarranty;
  final int chargedToCompany;
  final int chargedToRepresentative;
  final int chargedToMerchant;
  final int chargedToFactory;

  @override
  List<Object?> get props => <Object?>[
    orders,
    totalCost,
    freeUnderWarranty,
    chargedToCompany,
    chargedToRepresentative,
    chargedToMerchant,
    chargedToFactory,
  ];
}

/// `GET /machines/:id/maintenance-history` — every repair a unit has had, with
/// the totals the server already computed. Read-only: opening, closing and
/// costing an order is section `11`'s write side.
class MachineMaintenanceHistory extends Equatable {
  const MachineMaintenanceHistory({
    required this.machineId,
    required this.serial,
    required this.totals,
    required this.orders,
    this.ordersMeta = PaginationMetaModel.empty,
  });

  final String machineId;
  final String serial;
  final MaintenanceHistoryTotals totals;
  final List<MaintenanceOrderSummary> orders;
  final PaginationMetaModel ordersMeta;

  MachineMaintenanceHistory copyWith({
    List<MaintenanceOrderSummary>? orders,
    PaginationMetaModel? ordersMeta,
  }) {
    return MachineMaintenanceHistory(
      machineId: machineId,
      serial: serial,
      totals: totals,
      orders: orders ?? this.orders,
      ordersMeta: ordersMeta ?? this.ordersMeta,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    machineId,
    serial,
    totals,
    orders,
    ordersMeta,
  ];
}
