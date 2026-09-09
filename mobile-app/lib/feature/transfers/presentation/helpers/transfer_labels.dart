import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/utils/enums.dart';

/// Turns the transfer enums into the words a user reads. A raw
/// `BRANCH_TO_REPRESENTATIVE` must never reach the screen.
abstract class TransferLabels {
  static String status(TransferStatus status) {
    return switch (status) {
      TransferStatus.pending => LocaleKeys.transferStatusPending,
      TransferStatus.confirmed => LocaleKeys.transferStatusConfirmed,
      TransferStatus.rejected => LocaleKeys.transferStatusRejected,
      TransferStatus.cancelled => LocaleKeys.transferStatusCancelled,
      TransferStatus.unknown => LocaleKeys.transferStatusUnknown,
    }.tr();
  }

  static String type(TransferType type) {
    return switch (type) {
      TransferType.factoryToCompany => LocaleKeys.transferTypeFactoryToCompany,
      TransferType.companyToBranch => LocaleKeys.transferTypeCompanyToBranch,
      TransferType.branchToRepresentative =>
        LocaleKeys.transferTypeBranchToRepresentative,
      TransferType.representativeToMerchant =>
        LocaleKeys.transferTypeRepresentativeToMerchant,
      TransferType.merchantToRepresentative =>
        LocaleKeys.transferTypeMerchantToRepresentative,
      TransferType.representativeToBranch =>
        LocaleKeys.transferTypeRepresentativeToBranch,
      TransferType.branchToCompany => LocaleKeys.transferTypeBranchToCompany,
      TransferType.companyToMaintenance =>
        LocaleKeys.transferTypeCompanyToMaintenance,
      TransferType.maintenanceToCompany =>
        LocaleKeys.transferTypeMaintenanceToCompany,
      TransferType.companyToFactory => LocaleKeys.transferTypeCompanyToFactory,
      TransferType.factoryToCompanyReturn =>
        LocaleKeys.transferTypeFactoryToCompanyReturn,
      TransferType.companyToServiceCenter =>
        LocaleKeys.transferTypeCompanyToServiceCenter,
      TransferType.serviceCenterToCompany =>
        LocaleKeys.transferTypeServiceCenterToCompany,
      TransferType.companyToScrap => LocaleKeys.transferTypeCompanyToScrap,
      TransferType.unknown => LocaleKeys.transferTypeUnknown,
    }.tr();
  }

  static String condition(ItemCondition condition) {
    return switch (condition) {
      ItemCondition.good => LocaleKeys.itemConditionGood,
      ItemCondition.damaged => LocaleKeys.itemConditionDamaged,
      ItemCondition.notWorking => LocaleKeys.itemConditionNotWorking,
      ItemCondition.unknown => LocaleKeys.itemConditionUnknown,
    }.tr();
  }

  static String signatureRole(SignaturePartyRole role) {
    return switch (role) {
      SignaturePartyRole.sender => LocaleKeys.signatureRoleSender,
      SignaturePartyRole.receiver ||
      SignaturePartyRole.unknown => LocaleKeys.signatureRoleReceiver,
    }.tr();
  }

  /// The conditions a person can actually choose. `unknown` is what the server
  /// says when nobody looked, not something anyone selects.
  static const List<ItemCondition> selectableConditions = <ItemCondition>[
    ItemCondition.good,
    ItemCondition.damaged,
    ItemCondition.notWorking,
  ];
}
