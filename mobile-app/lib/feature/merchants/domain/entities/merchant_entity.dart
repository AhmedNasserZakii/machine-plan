import 'package:equatable/equatable.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';

/// A shop a machine ends up in.
///
/// A merchant is a record, not an account: he never logs in and never signs.
/// That is why placing a machine with him is the one hand-off the representative
/// attests to alone.
class MerchantEntity extends Equatable {
  const MerchantEntity({
    required this.id,
    required this.name,
    required this.shopName,
    required this.phone,
    required this.isActive,
    this.address,
    this.nationalId,
    this.branch,
    this.registeredBy,
    this.machinesCount = 0,
    this.activeSubscription,
    this.totalPaid = 0,
    this.notes,
    this.createdAt,
  });

  final String id;
  final String name;
  final String shopName;
  final String phone;
  final String? address;
  final String? nationalId;
  final BranchRef? branch;

  /// The representative who registered him — who a supervisor asks about a shop.
  final MerchantUserRef? registeredBy;

  /// What he is holding right now, which is what blocks closing him out.
  final int machinesCount;

  final SubscriptionEntity? activeSubscription;
  final double totalPaid;
  final String? notes;
  final DateTime? createdAt;
  final bool isActive;

  /// The machines have to come back through a hand-off before the record can be
  /// closed, so the button is disabled rather than left to fail with a 409.
  bool get canDeactivate => isActive && machinesCount == 0;

  bool get hasSubscription => activeSubscription != null;

  @override
  List<Object?> get props => <Object?>[
    id,
    name,
    shopName,
    phone,
    address,
    nationalId,
    branch,
    registeredBy,
    machinesCount,
    activeSubscription,
    totalPaid,
    isActive,
  ];
}

class MerchantUserRef extends Equatable {
  const MerchantUserRef({required this.id, required this.fullName});

  final String id;
  final String fullName;

  @override
  List<Object?> get props => <Object?>[id, fullName];
}

/// What the merchant pays and when he is next due.
class SubscriptionEntity extends Equatable {
  const SubscriptionEntity({
    required this.id,
    required this.planType,
    required this.amount,
    required this.startDate,
    required this.isActive,
    this.machineId,
    this.machineSerial,
    this.endDate,
    this.nextDueDate,
    this.isOverdue = false,
    this.totalCollected = 0,
    this.collectionCount = 0,
    this.lastCollectedAt,
    this.notes,
  });

  final String id;
  final SubscriptionPlanType planType;

  /// Null when the plan covers everything the merchant holds.
  final String? machineId;
  final String? machineSerial;

  final double amount;
  final String startDate;
  final String? endDate;
  final String? nextDueDate;

  /// Computed by the server against its own clock, so a phone with the wrong
  /// date still shows the truth.
  final bool isOverdue;

  final double totalCollected;
  final int collectionCount;
  final DateTime? lastCollectedAt;
  final bool isActive;
  final String? notes;

  /// A free arrangement has nothing to collect, so the button is not offered.
  bool get isCollectable => isActive && planType != SubscriptionPlanType.none;

  bool get isPerMachine => machineId != null;

  @override
  List<Object?> get props => <Object?>[
    id,
    planType,
    machineId,
    machineSerial,
    amount,
    startDate,
    endDate,
    nextDueDate,
    isOverdue,
    totalCollected,
    collectionCount,
    isActive,
  ];
}

/// What `POST /merchants/check` answers while the representative is still
/// typing. A repeated phone warns; a repeated national ID is always a mistake.
class MerchantDuplicateCheck extends Equatable {
  const MerchantDuplicateCheck({
    this.warnings = const <MerchantDuplicateWarning>[],
    this.existing = const <MerchantEntity>[],
  });

  final List<MerchantDuplicateWarning> warnings;
  final List<MerchantEntity> existing;

  bool get isClean => warnings.isEmpty;

  @override
  List<Object?> get props => <Object?>[warnings, existing];
}

/// One line of a merchant's story, assembled server-side from hand-offs, plans
/// and collections.
class MerchantTimelineEntry extends Equatable {
  const MerchantTimelineEntry({
    required this.kind,
    required this.occurredAt,
    required this.code,
    this.referenceNo,
    this.machineSerial,
    this.amount,
  });

  final MerchantTimelineKind kind;
  final DateTime occurredAt;

  /// A stable code the app localizes, e.g. `RECEIVED_MACHINE`.
  final String code;

  final String? referenceNo;
  final String? machineSerial;
  final double? amount;

  @override
  List<Object?> get props => <Object?>[
    kind,
    occurredAt,
    code,
    referenceNo,
    machineSerial,
    amount,
  ];
}

/// A merchant plus what he holds — the detail screen loads both together.
class MerchantDetail extends Equatable {
  const MerchantDetail({
    required this.merchant,
    this.machines = const <MachineEntity>[],
    this.subscriptions = const <SubscriptionEntity>[],
    this.timeline = const <MerchantTimelineEntry>[],
  });

  final MerchantEntity merchant;
  final List<MachineEntity> machines;
  final List<SubscriptionEntity> subscriptions;
  final List<MerchantTimelineEntry> timeline;

  MerchantDetail copyWith({
    MerchantEntity? merchant,
    List<MachineEntity>? machines,
    List<SubscriptionEntity>? subscriptions,
    List<MerchantTimelineEntry>? timeline,
  }) {
    return MerchantDetail(
      merchant: merchant ?? this.merchant,
      machines: machines ?? this.machines,
      subscriptions: subscriptions ?? this.subscriptions,
      timeline: timeline ?? this.timeline,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    merchant,
    machines,
    subscriptions,
    timeline,
  ];
}
