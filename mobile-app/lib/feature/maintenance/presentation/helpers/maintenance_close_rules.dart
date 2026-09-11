import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';

/// What closing the order will do to the books — mirrors `postClose()` in the
/// backend's `maintenance.service.ts` exactly, branch for branch, so the
/// preview shown before submitting and the artefact the server actually
/// posts can never say two different things.
enum MaintenanceCloseEffectKind {
  /// Under warranty, a zero cost, or the factory ate it — nothing is posted.
  none,
  companyExpense,
  representativeViolation,
  merchantFee,
}

class MaintenanceCloseEffect {
  const MaintenanceCloseEffect(this.kind, this.amount);

  final MaintenanceCloseEffectKind kind;
  final double amount;
}

/// [cost] is whatever the form currently holds, free-under-warranty or not —
/// the zero-or-negative and free-under-warranty short circuits below decide
/// on their own whether it is actually charged.
MaintenanceCloseEffect maintenanceCloseEffectFor({
  required bool isFreeUnderWarranty,
  required double cost,
  required MaintenanceResponsibleParty responsibleParty,
}) {
  if (isFreeUnderWarranty || cost <= 0) {
    return const MaintenanceCloseEffect(MaintenanceCloseEffectKind.none, 0);
  }

  return switch (responsibleParty) {
    MaintenanceResponsibleParty.factory => const MaintenanceCloseEffect(
      MaintenanceCloseEffectKind.none,
      0,
    ),
    MaintenanceResponsibleParty.company => MaintenanceCloseEffect(
      MaintenanceCloseEffectKind.companyExpense,
      cost,
    ),
    MaintenanceResponsibleParty.representative => MaintenanceCloseEffect(
      MaintenanceCloseEffectKind.representativeViolation,
      cost,
    ),
    MaintenanceResponsibleParty.merchant => MaintenanceCloseEffect(
      MaintenanceCloseEffectKind.merchantFee,
      cost,
    ),
    MaintenanceResponsibleParty.unknown => const MaintenanceCloseEffect(
      MaintenanceCloseEffectKind.none,
      0,
    ),
  };
}

/// A short reason code for why the form cannot be submitted yet — mirrors
/// `CloseMaintenanceOrderDto`'s `@ValidateIf` rules one for one, so a doomed
/// request never reaches the network. `null` means the form is submittable.
enum MaintenanceCloseBlockedReason {
  costRequired,
  responsibleUserRequired,
  responsibleMerchantRequired,
  paymentMethodRequired,
  replacementRequired,
}

MaintenanceCloseBlockedReason? maintenanceCloseBlockedReason({
  required bool isFreeUnderWarranty,
  required double? cost,
  required MaintenanceOrderResult? result,
  required MaintenanceResponsibleParty? responsibleParty,
  required String? responsibleUserId,
  required String? responsibleMerchantId,
  required String? paymentMethodId,
  required bool hasReplacement,
}) {
  if (!isFreeUnderWarranty && (cost == null || cost <= 0)) {
    return MaintenanceCloseBlockedReason.costRequired;
  }

  if (responsibleParty == MaintenanceResponsibleParty.representative &&
      responsibleUserId == null) {
    return MaintenanceCloseBlockedReason.responsibleUserRequired;
  }

  if (responsibleParty == MaintenanceResponsibleParty.merchant &&
      responsibleMerchantId == null) {
    return MaintenanceCloseBlockedReason.responsibleMerchantRequired;
  }

  if (!isFreeUnderWarranty &&
      responsibleParty == MaintenanceResponsibleParty.company &&
      paymentMethodId == null) {
    return MaintenanceCloseBlockedReason.paymentMethodRequired;
  }

  if (result == MaintenanceOrderResult.replaced && !hasReplacement) {
    return MaintenanceCloseBlockedReason.replacementRequired;
  }

  return null;
}
