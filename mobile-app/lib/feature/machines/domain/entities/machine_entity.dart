import 'package:equatable/equatable.dart';
import 'package:machinery/core/utils/enums.dart';

/// One delivered unit. Four serials identify it — machine, battery, SIM and box
/// — and none of them can ever change: a unit that comes back from the factory
/// with a different SIM is a *replacement*, which is a new record.
class MachineEntity extends Equatable {
  const MachineEntity({
    required this.id,
    required this.serial,
    required this.status,
    required this.hasBox,
    required this.type,
    required this.model,
    required this.warranty,
    this.simSerial,
    this.boxSerial,
    this.qrPayload,
    this.battery,
    this.branch,
    this.holder,
    this.purchase = const MachinePurchase(),
    this.maintenance = const MachineMaintenance(),
    this.notes,
    this.decommissionedAt,
    this.replacedByMachineId,
    this.replacesMachineId,
  });

  final String id;
  final String serial;
  final String? simSerial;
  final String? boxSerial;
  final String? qrPayload;
  final MachineStatus status;
  final bool hasBox;
  final MachineTypeRef type;
  final MachineModelRef model;
  final BatteryRef? battery;
  final BranchRef? branch;
  final MachineHolder? holder;
  final MachineWarranty warranty;
  final MachinePurchase purchase;
  final MachineMaintenance maintenance;
  final String? notes;
  final DateTime? decommissionedAt;
  final String? replacedByMachineId;
  final String? replacesMachineId;

  /// Retired units are read-only everywhere: there is nothing left to transfer,
  /// repair or edit.
  bool get isRetired =>
      status == MachineStatus.decommissioned ||
      status == MachineStatus.replaced;

  bool get isPartOfChain =>
      replacedByMachineId != null || replacesMachineId != null;

  @override
  List<Object?> get props => <Object?>[
    id,
    serial,
    simSerial,
    boxSerial,
    status,
    hasBox,
    type,
    model,
    battery,
    branch,
    holder,
    warranty,
    purchase,
    maintenance,
    notes,
  ];
}

class MachineTypeRef extends Equatable {
  const MachineTypeRef({
    required this.id,
    required this.name,
    required this.requiresSim,
  });

  final String id;
  final String name;

  /// Decides whether the form asks for a SIM serial at all. A pin pad has no
  /// mobile line, and the server rejects one that is sent anyway.
  final bool requiresSim;

  @override
  List<Object?> get props => <Object?>[id, name, requiresSim];
}

class MachineModelRef extends Equatable {
  const MachineModelRef({
    required this.id,
    required this.name,
    this.manufacturer,
  });

  final String id;
  final String name;
  final String? manufacturer;

  @override
  List<Object?> get props => <Object?>[id, name, manufacturer];
}

class BatteryRef extends Equatable {
  const BatteryRef({required this.id, required this.serial});

  final String id;
  final String serial;

  @override
  List<Object?> get props => <Object?>[id, serial];
}

class BranchRef extends Equatable {
  const BranchRef({required this.id, required this.name});

  final String id;
  final String name;

  @override
  List<Object?> get props => <Object?>[id, name];
}

/// Who physically holds the unit right now. The id is polymorphic — a
/// warehouse, a user or a merchant, depending on [type].
class MachineHolder extends Equatable {
  const MachineHolder({required this.type, this.id});

  final PartyType type;
  final String? id;

  @override
  List<Object?> get props => <Object?>[type, id];
}

/// The free-maintenance window. `isActive` is computed by the server against
/// its own clock, so a phone with the wrong date still shows the truth.
class MachineWarranty extends Equatable {
  const MachineWarranty({
    this.start,
    this.end,
    this.isActive = false,
    this.daysRemaining = 0,
  });

  final String? start;
  final String? end;
  final bool isActive;
  final int daysRemaining;

  bool get isKnown => end != null;

  /// The threshold the detail card turns amber at — a month is enough notice to
  /// get a unit back to the factory before the cover lapses.
  bool get isExpiringSoon => isActive && daysRemaining <= 30;

  @override
  List<Object?> get props => <Object?>[start, end, isActive, daysRemaining];
}

class MachinePurchase extends Equatable {
  const MachinePurchase({this.price, this.date, this.invoiceNo});

  final double? price;
  final String? date;
  final String? invoiceNo;

  @override
  List<Object?> get props => <Object?>[price, date, invoiceNo];
}

class MachineMaintenance extends Equatable {
  const MachineMaintenance({
    this.repairCount = 0,
    this.totalRepairCost = 0,
    this.costVsPricePercent,
  });

  final int repairCount;
  final double totalRepairCost;

  /// Null until the machine has a purchase price — a ratio against nothing
  /// means nothing.
  final double? costVsPricePercent;

  /// Past this, repairing again costs more than the unit is worth, and the
  /// detail screen says so out loud instead of leaving a director to do the
  /// division in their head.
  static const double scrapThresholdPercent = 60;

  bool get shouldConsiderScrapping =>
      (costVsPricePercent ?? 0) >= scrapThresholdPercent;

  @override
  List<Object?> get props => <Object?>[
    repairCount,
    totalRepairCost,
    costVsPricePercent,
  ];
}

/// `GET /machines/:id/cost-summary` — chain-aware economics used before an
/// irreversible decommission decision.
class MachineCostSummary extends Equatable {
  const MachineCostSummary({
    required this.totalRepairCost,
    required this.repairCount,
    required this.ageMonths,
    required this.isInChain,
    required this.chainLength,
    this.purchasePrice,
    this.costToValueRatio,
  });

  final double? purchasePrice;
  final double totalRepairCost;
  final int repairCount;
  final double? costToValueRatio;
  final int ageMonths;
  final bool isInChain;
  final int chainLength;

  @override
  List<Object?> get props => <Object?>[
    purchasePrice,
    totalRepairCost,
    repairCount,
    costToValueRatio,
    ageMonths,
    isInChain,
    chainLength,
  ];
}
