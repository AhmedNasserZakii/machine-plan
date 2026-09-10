import 'package:equatable/equatable.dart';
import 'package:machinery/feature/machines/domain/entities/machine_maintenance_history.dart'
    show
        MaintenanceOrderResult,
        MaintenanceOrderStatus,
        MaintenanceResponsibleParty;

export 'package:machinery/feature/machines/domain/entities/machine_maintenance_history.dart'
    show
        MaintenanceOrderResult,
        MaintenanceOrderStatus,
        MaintenanceResponsibleParty;

/// The read-only machine-history screen (`8.1`) already defined
/// [MaintenanceOrderStatus]/[MaintenanceOrderResult]/[MaintenanceResponsibleParty]
/// before this feature existed — reused rather than redeclared, so the two
/// screens can never drift on what a status value means.
class MaintenanceMachineRef extends Equatable {
  const MaintenanceMachineRef({
    required this.id,
    required this.serial,
    this.status,
    this.model,
  });

  final String id;
  final String serial;
  final String? status;
  final String? model;

  @override
  List<Object?> get props => <Object?>[id, serial, status, model];
}

class MaintenanceLocationRef extends Equatable {
  const MaintenanceLocationRef({
    required this.id,
    required this.code,
    required this.name,
  });

  final String id;
  final String code;
  final String name;

  @override
  List<Object?> get props => <Object?>[id, code, name];
}

class MaintenanceBranchRef extends Equatable {
  const MaintenanceBranchRef({required this.id, required this.name});

  final String id;
  final String name;

  @override
  List<Object?> get props => <Object?>[id, name];
}

/// One repair order. List rows and the detail screen share this type — the
/// list simply arrives with the detail-only fields left null, the same
/// convention every other feature in this app uses for the same reason.
class MaintenanceOrderEntity extends Equatable {
  const MaintenanceOrderEntity({
    required this.id,
    required this.referenceNo,
    required this.machine,
    required this.location,
    required this.status,
    required this.sentAt,
    required this.isFreeUnderWarranty,
    required this.createdAt,
    this.result,
    this.returnedAt,
    this.cost,
    this.responsibleParty,
    this.branch,
    this.reportedFault,
    this.suggestedFreeUnderWarranty = false,
    this.responsibleUserId,
    this.responsibleMerchantId,
    this.paymentMethodId,
    this.supplierId,
    this.invoiceMediaId,
    this.performedByName,
    this.outTransferId,
    this.inTransferId,
    this.financeTransactionId,
    this.violationId,
    this.subscriptionId,
    this.replacementMachineId,
    this.closedAt,
    this.closedByUserId,
    this.cancelledAt,
    this.cancelReason,
    this.notes,
  });

  final String id;
  final String referenceNo;
  final MaintenanceMachineRef machine;
  final MaintenanceLocationRef location;
  final MaintenanceOrderStatus status;
  final MaintenanceOrderResult? result;
  final DateTime sentAt;
  final DateTime? returnedAt;
  final double? cost;
  final bool isFreeUnderWarranty;
  final MaintenanceResponsibleParty? responsibleParty;
  final MaintenanceBranchRef? branch;
  final DateTime createdAt;

  // Detail-only.
  final String? reportedFault;
  final bool suggestedFreeUnderWarranty;
  final String? responsibleUserId;
  final String? responsibleMerchantId;
  final String? paymentMethodId;
  final String? supplierId;
  final String? invoiceMediaId;
  final String? performedByName;
  final String? outTransferId;
  final String? inTransferId;
  final String? financeTransactionId;
  final String? violationId;
  final String? subscriptionId;
  final String? replacementMachineId;
  final DateTime? closedAt;
  final String? closedByUserId;
  final DateTime? cancelledAt;
  final String? cancelReason;
  final String? notes;

  bool get isOpen => status == MaintenanceOrderStatus.open;
  bool get isInProgress => status == MaintenanceOrderStatus.inProgress;
  bool get isReturned => status == MaintenanceOrderStatus.returned;
  bool get isClosed => status == MaintenanceOrderStatus.closed;
  bool get isCancelled => status == MaintenanceOrderStatus.cancelled;

  /// Cancel is refused server-side once the machine is physically out — from
  /// `IN_PROGRESS`/`RETURNED` it is only allowed once it is back
  /// (`inTransferId` set). Mirrored client-side so the cancel button does not
  /// invite a tap that can only fail.
  bool get canCancel {
    if (isOpen) return true;
    if ((isInProgress || isReturned) && inTransferId != null) return true;
    return false;
  }

  @override
  List<Object?> get props => <Object?>[
    id,
    referenceNo,
    machine,
    location,
    status,
    result,
    sentAt,
    returnedAt,
    cost,
    isFreeUnderWarranty,
    responsibleParty,
    branch,
    createdAt,
    reportedFault,
    suggestedFreeUnderWarranty,
    responsibleUserId,
    responsibleMerchantId,
    paymentMethodId,
    supplierId,
    invoiceMediaId,
    performedByName,
    outTransferId,
    inTransferId,
    financeTransactionId,
    violationId,
    subscriptionId,
    replacementMachineId,
    closedAt,
    closedByUserId,
    cancelledAt,
    cancelReason,
    notes,
  ];
}

/// `POST /machines/:id/replace` — the machine before and after the swap.
class MachineReplacedEntity extends Equatable {
  const MachineReplacedEntity({
    required this.oldMachineId,
    required this.newMachineId,
    this.maintenanceOrderId,
  });

  final String oldMachineId;
  final String newMachineId;
  final String? maintenanceOrderId;

  @override
  List<Object?> get props => <Object?>[
    oldMachineId,
    newMachineId,
    maintenanceOrderId,
  ];
}

/// `GET /replacements` — the log entry a swap leaves behind.
class ReplacementEntity extends Equatable {
  const ReplacementEntity({
    required this.id,
    required this.oldMachine,
    required this.newMachine,
    required this.reason,
    required this.replacedAt,
    required this.createdAt,
    this.maintenanceOrderId,
  });

  final String id;
  final MaintenanceMachineRef oldMachine;
  final MaintenanceMachineRef newMachine;
  final String? maintenanceOrderId;
  final String reason;
  final DateTime replacedAt;
  final DateTime createdAt;

  @override
  List<Object?> get props => <Object?>[
    id,
    oldMachine,
    newMachine,
    maintenanceOrderId,
    reason,
    replacedAt,
    createdAt,
  ];
}

/// `GET/POST /machines/:id/decommission` and `GET /decommissions`.
class DecommissionEntity extends Equatable {
  const DecommissionEntity({
    required this.id,
    required this.machine,
    required this.reasonCode,
    required this.reasonName,
    required this.notes,
    required this.decommissionedAt,
    required this.decommissionedByUserId,
    required this.snapshot,
    required this.createdAt,
    this.transferId,
    this.revertedAt,
    this.revertReason,
  });

  final String id;
  final MaintenanceMachineRef machine;
  final String reasonCode;
  final String reasonName;
  final String notes;
  final DateTime decommissionedAt;
  final String decommissionedByUserId;
  final DecommissionSnapshot snapshot;
  final String? transferId;
  final DateTime? revertedAt;
  final String? revertReason;
  final DateTime createdAt;

  bool get isReverted => revertedAt != null;

  @override
  List<Object?> get props => <Object?>[
    id,
    machine,
    reasonCode,
    reasonName,
    notes,
    decommissionedAt,
    decommissionedByUserId,
    snapshot,
    transferId,
    revertedAt,
    revertReason,
    createdAt,
  ];
}

class DecommissionSnapshot extends Equatable {
  const DecommissionSnapshot({
    this.purchasePrice,
    this.cumulativeRepairCost = 0,
    this.repairCount = 0,
    this.costToValueRatio,
    this.chainLength = 1,
  });

  final double? purchasePrice;
  final double cumulativeRepairCost;
  final int repairCount;
  final double? costToValueRatio;
  final int chainLength;

  @override
  List<Object?> get props => <Object?>[
    purchasePrice,
    cumulativeRepairCost,
    repairCount,
    costToValueRatio,
    chainLength,
  ];
}

enum DecommissionRecommendation {
  keep('KEEP'),
  review('REVIEW'),
  considerDecommission('CONSIDER_DECOMMISSION'),
  unknown('UNKNOWN');

  const DecommissionRecommendation(this.value);

  final String value;

  static DecommissionRecommendation fromJson(String? raw) {
    return DecommissionRecommendation.values.firstWhere(
      (DecommissionRecommendation value) => value.value == raw,
      orElse: () => DecommissionRecommendation.unknown,
    );
  }
}

/// `GET /machines/decommission-candidates` — a purely server-computed
/// insight row; nothing here is derived on the device.
class DecommissionCandidateEntity extends Equatable {
  const DecommissionCandidateEntity({
    required this.id,
    required this.serial,
    required this.status,
    required this.cumulativeRepairCost,
    required this.repairCount,
    required this.ageMonths,
    required this.isInChain,
    required this.chainLength,
    required this.recommendation,
    this.model,
    this.purchasePrice,
    this.costRatio,
    this.lastMaintenanceAt,
  });

  final String id;
  final String serial;
  final String status;
  final String? model;
  final double? purchasePrice;
  final double cumulativeRepairCost;
  final double? costRatio;
  final int repairCount;
  final int ageMonths;
  final bool isInChain;
  final int chainLength;
  final DecommissionRecommendation recommendation;
  final DateTime? lastMaintenanceAt;

  @override
  List<Object?> get props => <Object?>[
    id,
    serial,
    status,
    model,
    purchasePrice,
    cumulativeRepairCost,
    costRatio,
    repairCount,
    ageMonths,
    isInChain,
    chainLength,
    recommendation,
    lastMaintenanceAt,
  ];
}
