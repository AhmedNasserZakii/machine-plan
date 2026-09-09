import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/utils/enums.dart';

/// Raising one by hand. Everything the detector fills in automatically has to be
/// supplied here — including who is answerable, which the detector reads off the
/// transfer.
class CreateViolationParams {
  const CreateViolationParams({
    required this.violationTypeId,
    required this.userId,
    required this.severity,
    required this.description,
    this.machineId,
    this.transferItemId,
  });

  final String violationTypeId;
  final String userId;
  final String? machineId;
  final String? transferItemId;
  final ViolationSeverity severity;
  final String description;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.violationTypeId: violationTypeId,
    ApiKeys.userId: userId,
    ApiKeys.severity: severity.value,
    ApiKeys.description: description.trim(),
    if (machineId != null) ApiKeys.machineId: machineId,
    if (transferItemId != null) ApiKeys.transferItemId: transferItemId,
  };
}

/// The two fields a reviewer legitimately revises. Auto-generated rows reject
/// even these.
class UpdateViolationParams {
  const UpdateViolationParams({this.severity, this.description});

  final ViolationSeverity? severity;
  final String? description;

  Map<String, dynamic> toJson() => <String, dynamic>{
    if (severity != null) ApiKeys.severity: severity!.value,
    if (description != null && description!.trim().isNotEmpty)
      ApiKeys.description: description!.trim(),
  };
}

/// Taking the cost off the person responsible. This writes a finance
/// transaction, which is why it needs a payment method and a date.
class ChargeViolationParams {
  const ChargeViolationParams({
    required this.amount,
    required this.paymentMethodId,
    required this.chargedAt,
    this.notes,
  });

  final double amount;
  final String paymentMethodId;
  final String chargedAt;
  final String? notes;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.amount: amount,
    ApiKeys.paymentMethodId: paymentMethodId,
    ApiKeys.chargedAt: chargedAt,
    if (notes != null && notes!.trim().isNotEmpty) ApiKeys.notes: notes!.trim(),
  };
}

/// Letting it go. The reason is mandatory and it is not free text for its own
/// sake: a waiver with no explanation is indistinguishable from a favour.
class WaiveViolationParams {
  const WaiveViolationParams({required this.reason});

  final String reason;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.reason: reason.trim(),
  };
}
