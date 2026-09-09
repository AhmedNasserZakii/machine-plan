import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/utils/enums.dart';

/// Turns the merchant enums into the words a user reads. A raw value like
/// `ONE_TIME_FEE` must never reach the screen.
abstract class MerchantLabels {
  static String plan(SubscriptionPlanType plan) {
    return switch (plan) {
      SubscriptionPlanType.none => LocaleKeys.planTypeNone,
      SubscriptionPlanType.oneTimeFee => LocaleKeys.planTypeOneTimeFee,
      SubscriptionPlanType.weekly => LocaleKeys.planTypeWeekly,
      SubscriptionPlanType.monthly => LocaleKeys.planTypeMonthly,
      SubscriptionPlanType.unknown => LocaleKeys.planTypeUnknown,
    }.tr();
  }

  static String duplicateWarning(MerchantDuplicateWarning warning) {
    return switch (warning) {
      MerchantDuplicateWarning.duplicatePhone =>
        LocaleKeys.merchantDuplicatePhone,
      MerchantDuplicateWarning.duplicateNationalId =>
        LocaleKeys.merchantDuplicateNationalId,
      MerchantDuplicateWarning.unknown => LocaleKeys.merchantDuplicatePhone,
    }.tr();
  }

  /// The server sends a stable code rather than a sentence, so the same entry
  /// reads correctly in both languages.
  static String timelineCode(String code) {
    return switch (code) {
      'RECEIVED_MACHINE' ||
      'RECEIVED_MACHINES' => LocaleKeys.merchantTimelineReceived,
      'RETURNED_MACHINE' ||
      'RETURNED_MACHINES' => LocaleKeys.merchantTimelineReturned,
      'SUBSCRIPTION_STARTED' => LocaleKeys.merchantTimelineSubscribed,
      'COLLECTION' => LocaleKeys.merchantTimelineCollection,
      _ => LocaleKeys.merchantTimelineReceived,
    }.tr();
  }

  /// The plans the subscription form offers, cheapest arrangement first.
  /// `unknown` is not something anyone can choose.
  static const List<SubscriptionPlanType> selectablePlans =
      <SubscriptionPlanType>[
        SubscriptionPlanType.monthly,
        SubscriptionPlanType.weekly,
        SubscriptionPlanType.oneTimeFee,
        SubscriptionPlanType.none,
      ];
}
