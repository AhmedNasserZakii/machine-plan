import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';

class MaintenanceOrderResponseModel {
  const MaintenanceOrderResponseModel({required this.entity});

  final MaintenanceOrderEntity entity;

  factory MaintenanceOrderResponseModel.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> machine = _object(json[ApiKeys.machine]);
    final Map<String, dynamic> location = _object(json[ApiKeys.location]);
    final Map<String, dynamic> branch = _object(json[ApiKeys.branch]);

    return MaintenanceOrderResponseModel(
      entity: MaintenanceOrderEntity(
        id: json[ApiKeys.id]?.toString() ?? '',
        referenceNo: json[ApiKeys.referenceNo] as String? ?? '',
        machine: MaintenanceMachineRef(
          id: machine[ApiKeys.id]?.toString() ?? '',
          serial: machine[ApiKeys.serial] as String? ?? '',
          status: machine[ApiKeys.status] as String?,
          model: machine[ApiKeys.model] as String?,
        ),
        location: MaintenanceLocationRef(
          id: location[ApiKeys.id]?.toString() ?? '',
          code: location[ApiKeys.code] as String? ?? '',
          name: location[ApiKeys.name] as String? ?? '',
        ),
        status: MaintenanceOrderStatus.fromJson(
          json[ApiKeys.status] as String?,
        ),
        result: json[ApiKeys.result] == null
            ? null
            : MaintenanceOrderResult.fromJson(json[ApiKeys.result] as String?),
        sentAt: _dateOrNow(json[ApiKeys.sentAt]),
        returnedAt: _dateOrNull(json[ApiKeys.returnedAt]),
        cost: _double(json[ApiKeys.cost]),
        isFreeUnderWarranty:
            json[ApiKeys.isFreeUnderWarranty] as bool? ?? false,
        responsibleParty: json[ApiKeys.responsibleParty] == null
            ? null
            : MaintenanceResponsibleParty.fromJson(
                json[ApiKeys.responsibleParty] as String?,
              ),
        branch: branch.isEmpty
            ? null
            : MaintenanceBranchRef(
                id: branch[ApiKeys.id]?.toString() ?? '',
                name: branch[ApiKeys.name] as String? ?? '',
              ),
        createdAt: _dateOrNow(json[ApiKeys.createdAt]),
        reportedFault: json[ApiKeys.reportedFault] as String?,
        suggestedFreeUnderWarranty:
            json[ApiKeys.suggestedFreeUnderWarranty] as bool? ?? false,
        responsibleUserId: json[ApiKeys.responsibleUserId]?.toString(),
        responsibleMerchantId: json[ApiKeys.responsibleMerchantId]
            ?.toString(),
        paymentMethodId: json[ApiKeys.paymentMethodId]?.toString(),
        supplierId: json[ApiKeys.supplierId]?.toString(),
        invoiceMediaId: json[ApiKeys.invoiceMediaId]?.toString(),
        performedByName: json[ApiKeys.performedByName] as String?,
        outTransferId: json[ApiKeys.outTransferId]?.toString(),
        inTransferId: json[ApiKeys.inTransferId]?.toString(),
        financeTransactionId: json[ApiKeys.financeTransactionId]?.toString(),
        violationId: json[ApiKeys.violationId]?.toString(),
        subscriptionId: json[ApiKeys.subscriptionId]?.toString(),
        replacementMachineId: json[ApiKeys.replacementMachineId]?.toString(),
        closedAt: _dateOrNull(json[ApiKeys.closedAt]),
        closedByUserId: json[ApiKeys.closedByUserId]?.toString(),
        cancelledAt: _dateOrNull(json[ApiKeys.cancelledAt]),
        cancelReason: json[ApiKeys.cancelReason] as String?,
        notes: json[ApiKeys.notes] as String?,
      ),
    );
  }

  MaintenanceOrderEntity toEntity() => entity;
}

class MachineReplacedResponseModel {
  const MachineReplacedResponseModel({required this.entity});

  final MachineReplacedEntity entity;

  factory MachineReplacedResponseModel.fromJson(Map<String, dynamic> json) {
    return MachineReplacedResponseModel(
      entity: MachineReplacedEntity(
        oldMachineId: json[ApiKeys.oldMachineId]?.toString() ?? '',
        newMachineId: json[ApiKeys.newMachineId]?.toString() ?? '',
        maintenanceOrderId: json[ApiKeys.maintenanceOrderId]?.toString(),
      ),
    );
  }

  MachineReplacedEntity toEntity() => entity;
}

class ReplacementResponseModel {
  const ReplacementResponseModel({required this.entity});

  final ReplacementEntity entity;

  factory ReplacementResponseModel.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic> ref(String key) => _object(json[key]);

    MaintenanceMachineRef machineRef(Map<String, dynamic> raw) =>
        MaintenanceMachineRef(
          id: raw[ApiKeys.id]?.toString() ?? '',
          serial: raw[ApiKeys.serial] as String? ?? '',
          status: raw[ApiKeys.status] as String?,
        );

    return ReplacementResponseModel(
      entity: ReplacementEntity(
        id: json[ApiKeys.id]?.toString() ?? '',
        oldMachine: machineRef(ref(ApiKeys.oldMachine)),
        newMachine: machineRef(ref(ApiKeys.newMachine)),
        maintenanceOrderId: json[ApiKeys.maintenanceOrderId]?.toString(),
        reason: json[ApiKeys.reason] as String? ?? '',
        replacedAt: _dateOrNow(json[ApiKeys.replacedAt]),
        createdAt: _dateOrNow(json[ApiKeys.createdAt]),
      ),
    );
  }

  ReplacementEntity toEntity() => entity;
}

class DecommissionResponseModel {
  const DecommissionResponseModel({required this.entity});

  final DecommissionEntity entity;

  factory DecommissionResponseModel.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> machine = _object(json[ApiKeys.machine]);
    final Map<String, dynamic> snapshot = _object(json[ApiKeys.snapshot]);

    return DecommissionResponseModel(
      entity: DecommissionEntity(
        id: json[ApiKeys.id]?.toString() ?? '',
        machine: MaintenanceMachineRef(
          id: machine[ApiKeys.id]?.toString() ?? '',
          serial: machine[ApiKeys.serial] as String? ?? '',
          status: machine[ApiKeys.status] as String?,
        ),
        reasonCode: json[ApiKeys.reasonCode] as String? ?? '',
        reasonName: json[ApiKeys.reasonName] as String? ?? '',
        notes: json[ApiKeys.notes] as String? ?? '',
        decommissionedAt: _dateOrNow(json[ApiKeys.decommissionedAt]),
        decommissionedByUserId:
            json[ApiKeys.decommissionedByUserId]?.toString() ?? '',
        snapshot: DecommissionSnapshot(
          purchasePrice: _double(snapshot[ApiKeys.purchasePrice]),
          cumulativeRepairCost:
              _double(snapshot[ApiKeys.cumulativeRepairCost]) ?? 0,
          repairCount: _int(snapshot[ApiKeys.repairCount]),
          costToValueRatio: _double(snapshot[ApiKeys.costToValueRatio]),
          chainLength: _int(snapshot[ApiKeys.chainLength], fallback: 1),
        ),
        transferId: json[ApiKeys.transferId]?.toString(),
        revertedAt: _dateOrNull(json[ApiKeys.revertedAt]),
        revertReason: json[ApiKeys.revertReason] as String?,
        createdAt: _dateOrNow(json[ApiKeys.createdAt]),
      ),
    );
  }

  DecommissionEntity toEntity() => entity;
}

class DecommissionCandidateResponseModel {
  const DecommissionCandidateResponseModel({required this.entity});

  final DecommissionCandidateEntity entity;

  factory DecommissionCandidateResponseModel.fromJson(
    Map<String, dynamic> json,
  ) {
    return DecommissionCandidateResponseModel(
      entity: DecommissionCandidateEntity(
        id: json[ApiKeys.id]?.toString() ?? '',
        serial: json[ApiKeys.serial] as String? ?? '',
        status: json[ApiKeys.status] as String? ?? '',
        model: json[ApiKeys.model] as String?,
        purchasePrice: _double(json[ApiKeys.purchasePrice]),
        cumulativeRepairCost: _double(json[ApiKeys.cumulativeRepairCost]) ?? 0,
        costRatio: _double(json[ApiKeys.costToValueRatio] ?? json['costRatio']),
        repairCount: _int(json[ApiKeys.repairCount]),
        ageMonths: _int(json[ApiKeys.ageMonths]),
        isInChain: json[ApiKeys.isInChain] as bool? ?? false,
        chainLength: _int(json[ApiKeys.chainLength], fallback: 1),
        recommendation: DecommissionRecommendation.fromJson(
          json[ApiKeys.recommendation] as String?,
        ),
        lastMaintenanceAt: _dateOrNull(json[ApiKeys.lastMaintenanceAt]),
      ),
    );
  }

  DecommissionCandidateEntity toEntity() => entity;
}

Map<String, dynamic> _object(dynamic raw) =>
    raw is Map<String, dynamic> ? raw : const <String, dynamic>{};

double? _double(dynamic value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

int _int(dynamic value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

DateTime _dateOrNow(dynamic value) {
  if (value is String) {
    return DateTime.tryParse(value)?.toLocal() ?? DateTime.now();
  }
  return DateTime.now();
}

DateTime? _dateOrNull(dynamic value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value)?.toLocal();
}
