import 'package:equatable/equatable.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart'
    show SignatureParams;

/// The filter set behind `GET /maintenance-orders`.
class MaintenanceOrdersQueryParams extends Equatable {
  const MaintenanceOrdersQueryParams({
    this.page = 1,
    this.limit = 20,
    this.machineId,
    this.locationId,
    this.responsibleParty,
    this.branchId,
    this.isFreeUnderWarranty,
    this.statuses = const <MaintenanceOrderStatus>[],
    this.dateFrom,
    this.dateTo,
  });

  final int page;
  final int limit;
  final String? machineId;
  final String? locationId;
  final MaintenanceResponsibleParty? responsibleParty;
  final String? branchId;
  final bool? isFreeUnderWarranty;
  final List<MaintenanceOrderStatus> statuses;
  final String? dateFrom;
  final String? dateTo;

  bool get hasFilters =>
      locationId != null ||
      responsibleParty != null ||
      branchId != null ||
      isFreeUnderWarranty != null ||
      statuses.isNotEmpty ||
      dateFrom != null ||
      dateTo != null;

  int get activeFilterCount => <bool>[
    locationId != null,
    responsibleParty != null,
    branchId != null,
    isFreeUnderWarranty != null,
    statuses.isNotEmpty,
    dateFrom != null || dateTo != null,
  ].where((bool active) => active).length;

  MaintenanceOrdersQueryParams copyWith({
    int? page,
    int? limit,
    String? machineId,
    String? locationId,
    MaintenanceResponsibleParty? responsibleParty,
    String? branchId,
    bool? isFreeUnderWarranty,
    List<MaintenanceOrderStatus>? statuses,
    String? dateFrom,
    String? dateTo,
    bool resetLocation = false,
    bool resetResponsibleParty = false,
    bool resetBranch = false,
    bool resetWarranty = false,
    bool resetDates = false,
  }) {
    return MaintenanceOrdersQueryParams(
      page: page ?? this.page,
      limit: limit ?? this.limit,
      machineId: machineId ?? this.machineId,
      locationId: resetLocation ? null : (locationId ?? this.locationId),
      responsibleParty: resetResponsibleParty
          ? null
          : (responsibleParty ?? this.responsibleParty),
      branchId: resetBranch ? null : (branchId ?? this.branchId),
      isFreeUnderWarranty: resetWarranty
          ? null
          : (isFreeUnderWarranty ?? this.isFreeUnderWarranty),
      statuses: statuses ?? this.statuses,
      dateFrom: resetDates ? null : (dateFrom ?? this.dateFrom),
      dateTo: resetDates ? null : (dateTo ?? this.dateTo),
    );
  }

  /// Keeps whatever scoped this list — a machine's own history stays that
  /// machine's after "clear all".
  MaintenanceOrdersQueryParams cleared() =>
      MaintenanceOrdersQueryParams(page: 1, limit: limit, machineId: machineId);

  Map<String, dynamic> toQuery() {
    return <String, dynamic>{
      ApiKeys.page: page,
      ApiKeys.limit: limit,
      if (machineId != null) ApiKeys.machineId: machineId,
      if (locationId != null) ApiKeys.locationId: locationId,
      if (responsibleParty != null)
        ApiKeys.responsibleParty: responsibleParty!.value,
      if (branchId != null) ApiKeys.branchId: branchId,
      if (isFreeUnderWarranty != null)
        ApiKeys.isFreeUnderWarranty: isFreeUnderWarranty,
      if (statuses.isNotEmpty)
        ApiKeys.status: statuses
            .map((MaintenanceOrderStatus status) => status.value)
            .toList(growable: false),
      if (dateFrom != null) ApiKeys.dateFrom: dateFrom,
      if (dateTo != null) ApiKeys.dateTo: dateTo,
    };
  }

  @override
  List<Object?> get props => <Object?>[
    page,
    limit,
    machineId,
    locationId,
    responsibleParty,
    branchId,
    isFreeUnderWarranty,
    statuses,
    dateFrom,
    dateTo,
  ];
}

/// `POST /maintenance-orders`.
class CreateMaintenanceOrderParams {
  const CreateMaintenanceOrderParams({
    required this.machineId,
    required this.locationId,
    required this.reportedFault,
    required this.sentAt,
    this.notes,
  });

  final String machineId;
  final String locationId;
  final String reportedFault;
  final String sentAt;
  final String? notes;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.machineId: machineId,
    ApiKeys.locationId: locationId,
    ApiKeys.reportedFault: reportedFault.trim(),
    ApiKeys.sentAt: sentAt,
    if (notes != null && notes!.trim().isNotEmpty) ApiKeys.notes: notes!.trim(),
  };
}

/// `PATCH /maintenance-orders/:id`. Only what a correction may touch — set
/// fields are sent, unset ones are left alone server-side.
class UpdateMaintenanceOrderParams {
  const UpdateMaintenanceOrderParams({
    this.reportedFault,
    this.locationId,
    this.cost,
    this.performedByName,
    this.notes,
  });

  final String? reportedFault;
  final String? locationId;
  final double? cost;
  final String? performedByName;
  final String? notes;

  Map<String, dynamic> toJson() => <String, dynamic>{
    if (reportedFault != null) ApiKeys.reportedFault: reportedFault!.trim(),
    if (locationId != null) ApiKeys.locationId: locationId,
    if (cost != null) ApiKeys.cost: cost,
    if (performedByName != null)
      ApiKeys.performedByName: performedByName!.trim(),
    if (notes != null) ApiKeys.notes: notes!.trim(),
  };
}

/// `POST /maintenance-orders/:id/send` and `.../receive` share this shape —
/// both are a real hand-off under the hood and both require the same
/// signature evidence transfers do.
class MaintenanceHandoverParams {
  const MaintenanceHandoverParams({
    required this.signature,
    this.occurredAt,
    this.warehouseId,
  });

  final String? occurredAt;
  final String? warehouseId;
  final SignatureParams signature;

  Map<String, dynamic> toJson() => <String, dynamic>{
    if (occurredAt != null) ApiKeys.occurredAt: occurredAt,
    if (warehouseId != null) ApiKeys.warehouseId: warehouseId,
    ApiKeys.signature: signature.toJson(),
  };
}

/// `POST /maintenance-orders/:id/cancel`.
class CancelMaintenanceOrderParams {
  const CancelMaintenanceOrderParams({required this.reason});

  final String reason;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.reason: reason.trim(),
  };
}

/// The new unit a replacement swaps in — used both standalone
/// (`POST /machines/:id/replace`) and embedded in a close
/// (`CloseMaintenanceOrderParams.replacement`).
class ReplacementMachineParams {
  const ReplacementMachineParams({
    required this.newSerial,
    required this.newBatterySerial,
    required this.hasBox,
    required this.reason,
    required this.replacedAt,
    this.newSimSerial,
    this.newBoxSerial,
    this.machineModelId,
    this.newWarrantyStart,
    this.newWarrantyEnd,
  });

  final String newSerial;
  final String newBatterySerial;
  final bool hasBox;
  final String reason;
  final String replacedAt;
  final String? newSimSerial;
  final String? newBoxSerial;
  final String? machineModelId;
  final String? newWarrantyStart;
  final String? newWarrantyEnd;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.newSerial: newSerial.trim(),
    ApiKeys.newBattery: <String, dynamic>{
      ApiKeys.serial: newBatterySerial.trim(),
    },
    ApiKeys.hasBox: hasBox,
    ApiKeys.reason: reason.trim(),
    ApiKeys.replacedAt: replacedAt,
    if (newSimSerial != null && newSimSerial!.trim().isNotEmpty)
      ApiKeys.newSimSerial: newSimSerial!.trim(),
    if (newBoxSerial != null && newBoxSerial!.trim().isNotEmpty)
      ApiKeys.newBoxSerial: newBoxSerial!.trim(),
    if (machineModelId != null) ApiKeys.machineModelId: machineModelId,
    if (newWarrantyStart != null) ApiKeys.newWarrantyStart: newWarrantyStart,
    if (newWarrantyEnd != null) ApiKeys.newWarrantyEnd: newWarrantyEnd,
  };
}

/// `POST /maintenance-orders/:id/close`. The one call that both settles the
/// order and, when [result] is `REPLACED`, performs the swap in the same
/// request — see `11.2`.
class CloseMaintenanceOrderParams {
  const CloseMaintenanceOrderParams({
    required this.result,
    required this.isFreeUnderWarranty,
    required this.responsibleParty,
    required this.returnedAt,
    this.cost,
    this.responsibleUserId,
    this.responsibleMerchantId,
    this.paymentMethodId,
    this.supplierId,
    this.invoiceMediaId,
    this.replacement,
    this.performedByName,
    this.notes,
  });

  final MaintenanceOrderResult result;
  final bool isFreeUnderWarranty;
  final double? cost;
  final MaintenanceResponsibleParty responsibleParty;
  final String? responsibleUserId;
  final String? responsibleMerchantId;
  final String? paymentMethodId;
  final String? supplierId;
  final String? invoiceMediaId;
  final ReplacementMachineParams? replacement;
  final String? performedByName;
  final String returnedAt;
  final String? notes;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.result: result.value,
    ApiKeys.isFreeUnderWarranty: isFreeUnderWarranty,
    if (cost != null) ApiKeys.cost: cost,
    ApiKeys.responsibleParty: responsibleParty.value,
    if (responsibleUserId != null) ApiKeys.responsibleUserId: responsibleUserId,
    if (responsibleMerchantId != null)
      ApiKeys.responsibleMerchantId: responsibleMerchantId,
    if (paymentMethodId != null) ApiKeys.paymentMethodId: paymentMethodId,
    if (supplierId != null) ApiKeys.supplierId: supplierId,
    if (invoiceMediaId != null) ApiKeys.invoiceMediaId: invoiceMediaId,
    if (replacement != null) ApiKeys.replacement: replacement!.toJson(),
    if (performedByName != null)
      ApiKeys.performedByName: performedByName!.trim(),
    ApiKeys.returnedAt: returnedAt,
    if (notes != null && notes!.trim().isNotEmpty) ApiKeys.notes: notes!.trim(),
  };
}

/// `POST /machines/:id/decommission`.
class DecommissionMachineParams {
  const DecommissionMachineParams({
    required this.reasonId,
    required this.notes,
    required this.decommissionedAt,
    this.signature,
  });

  final String reasonId;
  final String notes;
  final String decommissionedAt;
  final SignatureParams? signature;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.reasonId: reasonId,
    ApiKeys.notes: notes.trim(),
    ApiKeys.decommissionedAt: decommissionedAt,
    if (signature != null) ApiKeys.signature: signature!.toJson(),
  };
}

/// `POST /machines/:id/decommission/revert`.
class RevertDecommissionParams {
  const RevertDecommissionParams({required this.reason});

  final String reason;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.reason: reason.trim(),
  };
}

/// `GET /decommissions`.
class DecommissionsQueryParams extends Equatable {
  const DecommissionsQueryParams({
    this.page = 1,
    this.limit = 20,
    this.reasonId,
    this.branchId,
    this.dateFrom,
    this.dateTo,
  });

  final int page;
  final int limit;
  final String? reasonId;
  final String? branchId;
  final String? dateFrom;
  final String? dateTo;

  DecommissionsQueryParams copyWith({int? page}) {
    return DecommissionsQueryParams(
      page: page ?? this.page,
      limit: limit,
      reasonId: reasonId,
      branchId: branchId,
      dateFrom: dateFrom,
      dateTo: dateTo,
    );
  }

  Map<String, dynamic> toQuery() => <String, dynamic>{
    ApiKeys.page: page,
    ApiKeys.limit: limit,
    if (reasonId != null) ApiKeys.reasonId: reasonId,
    if (branchId != null) ApiKeys.branchId: branchId,
    if (dateFrom != null) ApiKeys.dateFrom: dateFrom,
    if (dateTo != null) ApiKeys.dateTo: dateTo,
  };

  @override
  List<Object?> get props => <Object?>[
    page,
    limit,
    reasonId,
    branchId,
    dateFrom,
    dateTo,
  ];
}

/// `GET /machines/decommission-candidates`.
class DecommissionCandidatesQueryParams extends Equatable {
  const DecommissionCandidatesQueryParams({
    this.page = 1,
    this.limit = 20,
    this.minCostRatio,
    this.minRepairCount,
    this.minAgeMonths,
  });

  final int page;
  final int limit;
  final double? minCostRatio;
  final int? minRepairCount;
  final int? minAgeMonths;

  bool get hasFilters =>
      minCostRatio != null || minRepairCount != null || minAgeMonths != null;

  DecommissionCandidatesQueryParams copyWith({
    int? page,
    double? minCostRatio,
    int? minRepairCount,
    int? minAgeMonths,
    bool clearMinCostRatio = false,
    bool clearMinRepairCount = false,
    bool clearMinAgeMonths = false,
  }) {
    return DecommissionCandidatesQueryParams(
      page: page ?? this.page,
      limit: limit,
      minCostRatio: clearMinCostRatio
          ? null
          : (minCostRatio ?? this.minCostRatio),
      minRepairCount: clearMinRepairCount
          ? null
          : (minRepairCount ?? this.minRepairCount),
      minAgeMonths: clearMinAgeMonths
          ? null
          : (minAgeMonths ?? this.minAgeMonths),
    );
  }

  Map<String, dynamic> toQuery() => <String, dynamic>{
    ApiKeys.page: page,
    ApiKeys.limit: limit,
    if (minCostRatio != null) ApiKeys.minCostRatio: minCostRatio,
    if (minRepairCount != null) ApiKeys.minRepairCount: minRepairCount,
    if (minAgeMonths != null) ApiKeys.minAgeMonths: minAgeMonths,
  };

  @override
  List<Object?> get props => <Object?>[
    page,
    limit,
    minCostRatio,
    minRepairCount,
    minAgeMonths,
  ];
}
