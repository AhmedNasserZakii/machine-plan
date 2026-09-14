import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/utils/enums.dart';

/// Human labels for notification template codes and day-group headers.
abstract class NotificationLabels {
  NotificationLabels._();

  static String template(NotificationTemplateCode code) {
    return switch (code) {
      NotificationTemplateCode.transferPending =>
        LocaleKeys.notificationTemplateTransferPending.tr(),
      NotificationTemplateCode.transferConfirmed =>
        LocaleKeys.notificationTemplateTransferConfirmed.tr(),
      NotificationTemplateCode.transferRejected =>
        LocaleKeys.notificationTemplateTransferRejected.tr(),
      NotificationTemplateCode.transferReminder =>
        LocaleKeys.notificationTemplateTransferReminder.tr(),
      NotificationTemplateCode.transferStuck =>
        LocaleKeys.notificationTemplateTransferStuck.tr(),
      NotificationTemplateCode.violationCreated =>
        LocaleKeys.notificationTemplateViolationCreated.tr(),
      NotificationTemplateCode.violationCharged =>
        LocaleKeys.notificationTemplateViolationCharged.tr(),
      NotificationTemplateCode.maintenanceOpened =>
        LocaleKeys.notificationTemplateMaintenanceOpened.tr(),
      NotificationTemplateCode.maintenanceReturned =>
        LocaleKeys.notificationTemplateMaintenanceReturned.tr(),
      NotificationTemplateCode.machineReplaced =>
        LocaleKeys.notificationTemplateMachineReplaced.tr(),
      NotificationTemplateCode.warrantyExpiring =>
        LocaleKeys.notificationTemplateWarrantyExpiring.tr(),
      NotificationTemplateCode.warrantyExpired =>
        LocaleKeys.notificationTemplateWarrantyExpired.tr(),
      NotificationTemplateCode.budgetWarning =>
        LocaleKeys.notificationTemplateBudgetWarning.tr(),
      NotificationTemplateCode.budgetExceeded =>
        LocaleKeys.notificationTemplateBudgetExceeded.tr(),
      NotificationTemplateCode.subscriptionDue =>
        LocaleKeys.notificationTemplateSubscriptionDue.tr(),
      NotificationTemplateCode.subscriptionOverdue =>
        LocaleKeys.notificationTemplateSubscriptionOverdue.tr(),
      NotificationTemplateCode.machineIdle =>
        LocaleKeys.notificationTemplateMachineIdle.tr(),
      NotificationTemplateCode.decommissionCandidate =>
        LocaleKeys.notificationTemplateDecommissionCandidate.tr(),
      NotificationTemplateCode.machineDecommissioned =>
        LocaleKeys.notificationTemplateMachineDecommissioned.tr(),
      NotificationTemplateCode.digest =>
        LocaleKeys.notificationTemplateDigest.tr(),
      NotificationTemplateCode.unknown =>
        LocaleKeys.notificationTemplateUnknown.tr(),
    };
  }

  static String dayGroup(DateTime? when, {DateTime? now}) {
    if (when == null) {
      return LocaleKeys.notificationsGroupOlder.tr();
    }

    final DateTime today = (now ?? DateTime.now());
    final DateTime local = when.toLocal();
    final DateTime startOfToday = DateTime(today.year, today.month, today.day);
    final DateTime startOfDay = DateTime(local.year, local.month, local.day);
    final int dayDiff = startOfToday.difference(startOfDay).inDays;

    if (dayDiff == 0) {
      return LocaleKeys.notificationsGroupToday.tr();
    }
    if (dayDiff == 1) {
      return LocaleKeys.notificationsGroupYesterday.tr();
    }
    if (dayDiff >= 2 && dayDiff < 7) {
      return LocaleKeys.notificationsGroupThisWeek.tr();
    }
    return LocaleKeys.notificationsGroupOlder.tr();
  }

  static bool isSameDayGroup(DateTime? a, DateTime? b, {DateTime? now}) {
    return dayGroup(a, now: now) == dayGroup(b, now: now);
  }
}
