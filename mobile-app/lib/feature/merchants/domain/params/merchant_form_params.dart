import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/utils/enums.dart';

/// Registering a shop. The branch and the registering representative are taken
/// from the token, never from the body — a rep cannot file a merchant under
/// someone else's branch.
class CreateMerchantParams {
  const CreateMerchantParams({
    required this.name,
    required this.phone,
    required this.shopName,
    required this.address,
    this.nationalId,
    this.notes,
    this.clientUuid,
  });

  final String name;
  final String phone;
  final String shopName;
  final String address;
  final String? nationalId;
  final String? notes;

  /// Device-generated when the registration happens offline. Replaying it
  /// returns the merchant already registered instead of a duplicate
  /// (`CreateMerchantDto.clientUuid`, backend).
  final String? clientUuid;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.name: name.trim(),
    ApiKeys.phone: phone.trim(),
    ApiKeys.shopName: shopName.trim(),
    ApiKeys.address: address.trim(),
    if (_filled(nationalId)) ApiKeys.nationalId: nationalId!.trim(),
    if (_filled(notes)) ApiKeys.notes: notes!.trim(),
    if (clientUuid != null) ApiKeys.clientUuid: clientUuid,
  };
}

/// Correcting a record. Every field is optional, and only what changed is sent,
/// so two people editing different fields do not overwrite each other.
class UpdateMerchantParams {
  const UpdateMerchantParams({
    this.name,
    this.phone,
    this.shopName,
    this.address,
    this.nationalId,
    this.notes,
  });

  final String? name;
  final String? phone;
  final String? shopName;
  final String? address;
  final String? nationalId;
  final String? notes;

  Map<String, dynamic> toJson() => <String, dynamic>{
    if (_filled(name)) ApiKeys.name: name!.trim(),
    if (_filled(phone)) ApiKeys.phone: phone!.trim(),
    if (_filled(shopName)) ApiKeys.shopName: shopName!.trim(),
    if (_filled(address)) ApiKeys.address: address!.trim(),
    if (_filled(nationalId)) ApiKeys.nationalId: nationalId!.trim(),
    if (_filled(notes)) ApiKeys.notes: notes!.trim(),
  };
}

/// The pre-flight the registration form runs before it submits.
class CheckMerchantParams {
  const CheckMerchantParams({required this.phone, this.nationalId});

  final String phone;
  final String? nationalId;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.phone: phone.trim(),
    if (_filled(nationalId)) ApiKeys.nationalId: nationalId!.trim(),
  };
}

/// Arranging what a merchant pays. Omitting [machineId] makes the plan cover
/// everything he holds, which is the usual case.
class CreateSubscriptionParams {
  const CreateSubscriptionParams({
    required this.planType,
    required this.amount,
    required this.startDate,
    this.machineId,
    this.endDate,
    this.notes,
  });

  final SubscriptionPlanType planType;
  final String? machineId;
  final double amount;
  final String startDate;
  final String? endDate;
  final String? notes;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.planType: planType.value,
    ApiKeys.amount: amount,
    ApiKeys.startDate: startDate,
    if (machineId != null) ApiKeys.machineId: machineId,
    if (_filled(endDate)) ApiKeys.endDate: endDate,
    if (_filled(notes)) ApiKeys.notes: notes!.trim(),
  };
}

class UpdateSubscriptionParams {
  const UpdateSubscriptionParams({
    this.amount,
    this.endDate,
    this.isActive,
    this.notes,
  });

  final double? amount;
  final String? endDate;

  /// Ends the plan without deleting the collections already taken under it.
  final bool? isActive;

  final String? notes;

  Map<String, dynamic> toJson() => <String, dynamic>{
    if (amount != null) ApiKeys.amount: amount,
    if (_filled(endDate)) ApiKeys.endDate: endDate,
    if (isActive != null) ApiKeys.isActive: isActive,
    if (_filled(notes)) ApiKeys.notes: notes!.trim(),
  };
}

/// Taking money. The amount is not forced to match the plan: a merchant paying
/// half is a real thing, and refusing to record it just loses the record.
class CollectSubscriptionParams {
  const CollectSubscriptionParams({
    required this.amount,
    required this.collectedAt,
    required this.paymentMethodId,
    this.invoiceMediaId,
    this.notes,
  });

  final double amount;
  final String collectedAt;
  final String paymentMethodId;

  /// A photographed receipt, uploaded through the media flow first.
  final String? invoiceMediaId;

  final String? notes;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.amount: amount,
    ApiKeys.collectedAt: collectedAt,
    ApiKeys.paymentMethodId: paymentMethodId,
    if (invoiceMediaId != null) ApiKeys.invoiceMediaId: invoiceMediaId,
    if (_filled(notes)) ApiKeys.notes: notes!.trim(),
  };
}

bool _filled(String? value) => value != null && value.trim().isNotEmpty;
