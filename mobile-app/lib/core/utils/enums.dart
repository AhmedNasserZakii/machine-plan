// Backend enum mirrors. The wire value is the backend's SCREAMING_SNAKE
// string; `fromJson` never throws so an unknown future value degrades to
// `unknown` instead of crashing a list.

enum MachineStatus {
  inCompanyWarehouse('IN_COMPANY_WAREHOUSE'),
  inBranchWarehouse('IN_BRANCH_WAREHOUSE'),
  withSupervisor('WITH_SUPERVISOR'),
  withRepresentative('WITH_REPRESENTATIVE'),
  withMerchant('WITH_MERCHANT'),
  inTransit('IN_TRANSIT'),
  underMaintenance('UNDER_MAINTENANCE'),
  atFactory('AT_FACTORY'),
  atServiceCenter('AT_SERVICE_CENTER'),
  decommissioned('DECOMMISSIONED'),
  replaced('REPLACED'),
  unknown('UNKNOWN');

  const MachineStatus(this.value);

  final String value;

  static MachineStatus fromJson(String? raw) {
    return MachineStatus.values.firstWhere(
      (status) => status.value == raw,
      orElse: () => MachineStatus.unknown,
    );
  }
}

enum TransferStatus {
  pending('PENDING'),
  confirmed('CONFIRMED'),
  rejected('REJECTED'),
  cancelled('CANCELLED'),
  unknown('UNKNOWN');

  const TransferStatus(this.value);

  final String value;

  static TransferStatus fromJson(String? raw) {
    return TransferStatus.values.firstWhere(
      (status) => status.value == raw,
      orElse: () => TransferStatus.unknown,
    );
  }
}

/// The custody graph's edges. Which of these a user may initiate is decided by
/// the backend's rules map, not here — the app only renders what it is told.
enum TransferType {
  factoryToCompany('FACTORY_TO_COMPANY'),
  companyToBranch('COMPANY_TO_BRANCH'),
  branchToRepresentative('BRANCH_TO_REPRESENTATIVE'),
  representativeToMerchant('REPRESENTATIVE_TO_MERCHANT'),
  merchantToRepresentative('MERCHANT_TO_REPRESENTATIVE'),
  representativeToBranch('REPRESENTATIVE_TO_BRANCH'),
  branchToCompany('BRANCH_TO_COMPANY'),
  companyToMaintenance('COMPANY_TO_MAINTENANCE'),
  maintenanceToCompany('MAINTENANCE_TO_COMPANY'),
  companyToFactory('COMPANY_TO_FACTORY'),
  factoryToCompanyReturn('FACTORY_TO_COMPANY_RETURN'),
  companyToServiceCenter('COMPANY_TO_SERVICE_CENTER'),
  serviceCenterToCompany('SERVICE_CENTER_TO_COMPANY'),
  companyToScrap('COMPANY_TO_SCRAP'),
  unknown('UNKNOWN');

  const TransferType(this.value);

  final String value;

  static TransferType fromJson(String? raw) {
    return TransferType.values.firstWhere(
      (type) => type.value == raw,
      orElse: () => TransferType.unknown,
    );
  }
}

enum ItemCondition {
  good('GOOD'),
  damaged('DAMAGED'),
  notWorking('NOT_WORKING'),
  unknown('UNKNOWN');

  const ItemCondition(this.value);

  final String value;

  static ItemCondition fromJson(String? raw) {
    return ItemCondition.values.firstWhere(
      (condition) => condition.value == raw,
      orElse: () => ItemCondition.unknown,
    );
  }
}

enum SignatureMethod {
  drawn('DRAWN_SIGNATURE'),
  biometric('BIOMETRIC'),
  unknown('UNKNOWN');

  const SignatureMethod(this.value);

  final String value;

  static SignatureMethod fromJson(String? raw) {
    return SignatureMethod.values.firstWhere(
      (method) => method.value == raw,
      orElse: () => SignatureMethod.unknown,
    );
  }
}

enum SignaturePartyRole {
  sender('SENDER'),
  receiver('RECEIVER'),
  unknown('UNKNOWN');

  const SignaturePartyRole(this.value);

  final String value;

  static SignaturePartyRole fromJson(String? raw) {
    return SignaturePartyRole.values.firstWhere(
      (role) => role.value == raw,
      orElse: () => SignaturePartyRole.unknown,
    );
  }
}

enum TransferDirection {
  out('OUT'),
  returned('RETURN'),
  unknown('UNKNOWN');

  const TransferDirection(this.value);

  final String value;

  static TransferDirection fromJson(String? raw) {
    return TransferDirection.values.firstWhere(
      (direction) => direction.value == raw,
      orElse: () => TransferDirection.unknown,
    );
  }
}

enum PartyType {
  factory('FACTORY'),
  warehouse('WAREHOUSE'),
  supervisor('SUPERVISOR'),
  representative('REPRESENTATIVE'),
  merchant('MERCHANT'),
  serviceCenter('SERVICE_CENTER'),
  unknown('UNKNOWN');

  const PartyType(this.value);

  final String value;

  static PartyType fromJson(String? raw) {
    return PartyType.values.firstWhere(
      (party) => party.value == raw,
      orElse: () => PartyType.unknown,
    );
  }
}

enum ViolationSeverity {
  low('LOW'),
  medium('MEDIUM'),
  high('HIGH'),
  unknown('UNKNOWN');

  const ViolationSeverity(this.value);

  final String value;

  static ViolationSeverity fromJson(String? raw) {
    return ViolationSeverity.values.firstWhere(
      (severity) => severity.value == raw,
      orElse: () => ViolationSeverity.unknown,
    );
  }
}

enum BudgetStatus {
  ok('OK'),
  warning('WARNING'),
  exceeded('EXCEEDED'),
  unknown('UNKNOWN');

  const BudgetStatus(this.value);

  final String value;

  static BudgetStatus fromJson(String? raw) {
    return BudgetStatus.values.firstWhere(
      (status) => status.value == raw,
      orElse: () => BudgetStatus.unknown,
    );
  }
}

/// Whether a queued write has been accepted by the backend yet.
///
/// `conflict` is distinct from `failed`: a `failed` item is dead (the server
/// will never accept it as queued — a validation error, a permission the
/// device no longer has) and offers delete. A `conflict` item recorded
/// something real — a signed hand-off — that the server's state now
/// contradicts, and must never be silently dropped or silently retried; only
/// a person may resolve it (`07`).
enum SyncItemStatus { pending, inFlight, failed, conflict, synced }

enum SubscriptionPlanType {
  none('NONE'),
  oneTimeFee('ONE_TIME_FEE'),
  weekly('WEEKLY'),
  monthly('MONTHLY'),
  unknown('UNKNOWN');

  const SubscriptionPlanType(this.value);

  final String value;

  static SubscriptionPlanType fromJson(String? raw) {
    return SubscriptionPlanType.values.firstWhere(
      (plan) => plan.value == raw,
      orElse: () => SubscriptionPlanType.unknown,
    );
  }
}

enum ViolationStatus {
  open('OPEN'),
  acknowledged('ACKNOWLEDGED'),
  waived('WAIVED'),
  charged('CHARGED'),
  closed('CLOSED'),
  unknown('UNKNOWN');

  const ViolationStatus(this.value);

  final String value;

  static ViolationStatus fromJson(String? raw) {
    return ViolationStatus.values.firstWhere(
      (status) => status.value == raw,
      orElse: () => ViolationStatus.unknown,
    );
  }
}

/// What a merchant's timeline entry is about. The server sends three kinds;
/// anything newer degrades to [unknown] rather than dropping the row.
enum MerchantTimelineKind {
  transfer('TRANSFER'),
  subscriptionStarted('SUBSCRIPTION_STARTED'),
  collection('COLLECTION'),
  unknown('UNKNOWN');

  const MerchantTimelineKind(this.value);

  final String value;

  static MerchantTimelineKind fromJson(String? raw) {
    return MerchantTimelineKind.values.firstWhere(
      (kind) => kind.value == raw,
      orElse: () => MerchantTimelineKind.unknown,
    );
  }
}

/// Why a registration form is warning the representative. A repeated phone is
/// allowed through; a repeated national ID is refused by the server.
enum MerchantDuplicateWarning {
  duplicatePhone('DUPLICATE_PHONE'),
  duplicateNationalId('DUPLICATE_NATIONAL_ID'),
  unknown('UNKNOWN');

  const MerchantDuplicateWarning(this.value);

  final String value;

  static MerchantDuplicateWarning fromJson(String? raw) {
    return MerchantDuplicateWarning.values.firstWhere(
      (warning) => warning.value == raw,
      orElse: () => MerchantDuplicateWarning.unknown,
    );
  }
}

/// The direction a representative's violation record is moving, as the server
/// judges it: the last six months against the six before them.
enum ViolationTrend {
  improving('IMPROVING'),
  steady('STEADY'),
  worsening('WORSENING'),
  unknown('UNKNOWN');

  const ViolationTrend(this.value);

  final String value;

  static ViolationTrend fromJson(String? raw) {
    return ViolationTrend.values.firstWhere(
      (trend) => trend.value == raw,
      orElse: () => ViolationTrend.unknown,
    );
  }
}
