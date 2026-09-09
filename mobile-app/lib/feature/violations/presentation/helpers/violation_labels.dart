import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/utils/enums.dart';

/// Turns the violation enums into the words a user reads, and the colours a
/// chip is drawn in. A raw value like `ACKNOWLEDGED` must never reach the
/// screen.
abstract class ViolationLabels {
  static String status(ViolationStatus status) {
    return switch (status) {
      ViolationStatus.open => LocaleKeys.violationStatusOpen,
      ViolationStatus.acknowledged => LocaleKeys.violationStatusAcknowledged,
      ViolationStatus.waived => LocaleKeys.violationStatusWaived,
      ViolationStatus.charged => LocaleKeys.violationStatusCharged,
      ViolationStatus.closed => LocaleKeys.violationStatusClosed,
      ViolationStatus.unknown => LocaleKeys.violationStatusUnknown,
    }.tr();
  }

  static String severity(ViolationSeverity severity) {
    return switch (severity) {
      ViolationSeverity.low => LocaleKeys.violationSeverityLow,
      ViolationSeverity.medium => LocaleKeys.violationSeverityMedium,
      ViolationSeverity.high => LocaleKeys.violationSeverityHigh,
      ViolationSeverity.unknown => LocaleKeys.violationSeverityUnknown,
    }.tr();
  }

  static String trend(ViolationTrend trend) {
    return switch (trend) {
      ViolationTrend.improving => LocaleKeys.violationTrendImproving,
      ViolationTrend.steady => LocaleKeys.violationTrendSteady,
      ViolationTrend.worsening => LocaleKeys.violationTrendWorsening,
      ViolationTrend.unknown => LocaleKeys.violationTrendUnknown,
    }.tr();
  }

  /// Open and acknowledged are both unfinished, so they read as work left to
  /// do. Waived is neutral, not green: nothing was put right, it was let go.
  static Color statusColor(ViolationStatus status) {
    return switch (status) {
      ViolationStatus.open => AppColors.dangerColor,
      ViolationStatus.acknowledged => AppColors.warningColor,
      ViolationStatus.charged => AppColors.successColor,
      ViolationStatus.waived => AppColors.neutralColor,
      ViolationStatus.closed => AppColors.neutralColor,
      ViolationStatus.unknown => AppColors.neutralColor,
    };
  }

  static IconData statusIcon(ViolationStatus status) {
    return switch (status) {
      ViolationStatus.open => Icons.error_outline_rounded,
      ViolationStatus.acknowledged => Icons.visibility_outlined,
      ViolationStatus.charged => Icons.payments_outlined,
      ViolationStatus.waived => Icons.do_not_disturb_on_outlined,
      ViolationStatus.closed => Icons.check_circle_outline_rounded,
      ViolationStatus.unknown => Icons.help_outline_rounded,
    };
  }

  static IconData trendIcon(ViolationTrend trend) {
    return switch (trend) {
      ViolationTrend.improving => Icons.trending_down_rounded,
      ViolationTrend.worsening => Icons.trending_up_rounded,
      ViolationTrend.steady => Icons.trending_flat_rounded,
      ViolationTrend.unknown => Icons.help_outline_rounded,
    };
  }

  /// Fewer violations is better, so a falling line is green — the opposite of
  /// what a chart usually means, and worth being deliberate about.
  static Color trendColor(ViolationTrend trend) {
    return switch (trend) {
      ViolationTrend.improving => AppColors.successColor,
      ViolationTrend.worsening => AppColors.dangerColor,
      ViolationTrend.steady => AppColors.neutralColor,
      ViolationTrend.unknown => AppColors.neutralColor,
    };
  }

  /// The statuses the filter sheet offers, in the order one moves through them.
  static const List<ViolationStatus> filterableStatuses = <ViolationStatus>[
    ViolationStatus.open,
    ViolationStatus.acknowledged,
    ViolationStatus.charged,
    ViolationStatus.waived,
    ViolationStatus.closed,
  ];

  static const List<ViolationSeverity> filterableSeverities =
      <ViolationSeverity>[
        ViolationSeverity.low,
        ViolationSeverity.medium,
        ViolationSeverity.high,
      ];
}
