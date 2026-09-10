import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';

/// Turns the maintenance/decommission enums into the words a user reads, and
/// the colours a chip is drawn in. A raw value like `IN_PROGRESS` must never
/// reach the screen.
abstract class MaintenanceLabels {
  static String status(MaintenanceOrderStatus status) {
    return switch (status) {
      MaintenanceOrderStatus.open => LocaleKeys.maintenanceStatusOpen,
      MaintenanceOrderStatus.inProgress =>
        LocaleKeys.maintenanceStatusInProgress,
      MaintenanceOrderStatus.returned => LocaleKeys.maintenanceStatusReturned,
      MaintenanceOrderStatus.closed => LocaleKeys.maintenanceStatusClosed,
      MaintenanceOrderStatus.cancelled =>
        LocaleKeys.maintenanceStatusCancelled,
      MaintenanceOrderStatus.unknown => LocaleKeys.maintenanceStatusUnknown,
    }.tr();
  }

  static Color statusColor(MaintenanceOrderStatus status) {
    return switch (status) {
      MaintenanceOrderStatus.open => AppColors.warningColor,
      MaintenanceOrderStatus.inProgress => AppColors.warningColor,
      MaintenanceOrderStatus.returned => AppColors.infoColor,
      MaintenanceOrderStatus.closed => AppColors.successColor,
      MaintenanceOrderStatus.cancelled => AppColors.neutralColor,
      MaintenanceOrderStatus.unknown => AppColors.neutralColor,
    };
  }

  static IconData statusIcon(MaintenanceOrderStatus status) {
    return switch (status) {
      MaintenanceOrderStatus.open => Icons.schedule_outlined,
      MaintenanceOrderStatus.inProgress => Icons.build_circle_outlined,
      MaintenanceOrderStatus.returned => Icons.move_to_inbox_outlined,
      MaintenanceOrderStatus.closed => Icons.check_circle_outline_rounded,
      MaintenanceOrderStatus.cancelled => Icons.cancel_outlined,
      MaintenanceOrderStatus.unknown => Icons.help_outline_rounded,
    };
  }

  static String result(MaintenanceOrderResult result) {
    return switch (result) {
      MaintenanceOrderResult.repaired => LocaleKeys.maintenanceResultRepaired,
      MaintenanceOrderResult.replaced => LocaleKeys.maintenanceResultReplaced,
      MaintenanceOrderResult.unrepairable =>
        LocaleKeys.maintenanceResultUnrepairable,
      MaintenanceOrderResult.unknown => LocaleKeys.maintenanceResultUnknown,
    }.tr();
  }

  static String responsibleParty(MaintenanceResponsibleParty party) {
    return switch (party) {
      MaintenanceResponsibleParty.company =>
        LocaleKeys.maintenanceResponsibleCompany,
      MaintenanceResponsibleParty.representative =>
        LocaleKeys.maintenanceResponsibleRepresentative,
      MaintenanceResponsibleParty.merchant =>
        LocaleKeys.maintenanceResponsibleMerchant,
      MaintenanceResponsibleParty.factory =>
        LocaleKeys.maintenanceResponsibleFactory,
      MaintenanceResponsibleParty.unknown =>
        LocaleKeys.maintenanceResponsibleUnknown,
    }.tr();
  }

  static String recommendation(DecommissionRecommendation recommendation) {
    return switch (recommendation) {
      DecommissionRecommendation.keep =>
        LocaleKeys.decommissionRecommendationKeep,
      DecommissionRecommendation.review =>
        LocaleKeys.decommissionRecommendationReview,
      DecommissionRecommendation.considerDecommission =>
        LocaleKeys.decommissionRecommendationConsider,
      DecommissionRecommendation.unknown =>
        LocaleKeys.maintenanceResponsibleUnknown,
    }.tr();
  }

  static Color recommendationColor(DecommissionRecommendation recommendation) {
    return switch (recommendation) {
      DecommissionRecommendation.keep => AppColors.successColor,
      DecommissionRecommendation.review => AppColors.warningColor,
      DecommissionRecommendation.considerDecommission =>
        AppColors.dangerColor,
      DecommissionRecommendation.unknown => AppColors.neutralColor,
    };
  }

  /// The statuses the filter sheet offers, in the order a repair moves
  /// through them.
  static const List<MaintenanceOrderStatus> filterableStatuses =
      <MaintenanceOrderStatus>[
        MaintenanceOrderStatus.open,
        MaintenanceOrderStatus.inProgress,
        MaintenanceOrderStatus.returned,
        MaintenanceOrderStatus.closed,
        MaintenanceOrderStatus.cancelled,
      ];

  static const List<MaintenanceResponsibleParty> filterableResponsibleParties =
      <MaintenanceResponsibleParty>[
        MaintenanceResponsibleParty.company,
        MaintenanceResponsibleParty.representative,
        MaintenanceResponsibleParty.merchant,
        MaintenanceResponsibleParty.factory,
      ];
}
