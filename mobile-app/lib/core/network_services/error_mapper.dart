import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/constants/locale_keys.dart';

/// Maps stable backend error codes onto app-owned wording.
///
/// The app's own copy wins so offline errors read exactly the same as online
/// ones. An unmapped code falls back to the server message, so a new backend
/// error is never a blank dialog.
abstract class ErrorMapper {
  static String messageFor({
    required String code,
    required String? serverMessage,
  }) {
    final String? localized = switch (code) {
      'MACHINE_ALREADY_IN_TRANSIT' => LocaleKeys.errorMachineAlreadyInTransit,
      'NOT_IN_YOUR_CUSTODY' => LocaleKeys.errorNotInYourCustody,
      'INVALID_MACHINE_STATUS' => LocaleKeys.errorInvalidMachineStatus,
      'SIM_SERIAL_EXISTS' => LocaleKeys.errorSimSerialExists,
      'BOX_SERIAL_EXISTS' => LocaleKeys.errorBoxSerialExists,
      'PAYLOAD_CHANGED' => LocaleKeys.errorPayloadChanged,
      'CATEGORY_KIND_MISMATCH' => LocaleKeys.errorCategoryKindMismatch,
      'CIRCULAR_CATEGORY_REFERENCE' => LocaleKeys.errorCategoryCycle,
      'CATEGORY_HAS_CHILDREN' => LocaleKeys.errorCategoryHasChildren,
      'CATEGORY_HAS_TRANSACTIONS' => LocaleKeys.errorCategoryHasTransactions,
      'SYSTEM_CATEGORY_PROTECTED' => LocaleKeys.errorSystemCategoryProtected,
      'AUTO_TRANSACTION_IMMUTABLE' =>
        LocaleKeys.errorAutomaticTransactionImmutable,
      'EDIT_WINDOW_EXPIRED' => LocaleKeys.errorFinanceEditWindowExpired,
      'OVERLAPPING_BUDGET' => LocaleKeys.errorOverlappingBudget,
      'BUDGET_ON_INCOME_CATEGORY' => LocaleKeys.errorBudgetOnIncomeCategory,
      'CLIENT_UPGRADE_REQUIRED' => LocaleKeys.upgradeRequiredMessage,
      'INVALID_CREDENTIALS' => LocaleKeys.errorInvalidCredentials,
      'ACCOUNT_INACTIVE' => LocaleKeys.errorAccountInactive,
      'ACCOUNT_LOCKED' => LocaleKeys.errorAccountLocked,
      _ => null,
    };

    if (localized != null) {
      return localized.tr();
    }

    if (serverMessage != null && serverMessage.trim().isNotEmpty) {
      return serverMessage;
    }

    return LocaleKeys.anErrorOccurred.tr();
  }
}
