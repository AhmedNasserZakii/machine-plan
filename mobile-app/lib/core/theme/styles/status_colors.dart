import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/utils/enums.dart';

/// The single source of truth for status colouring. Cards, chips, filters,
/// timelines and reports all read from here.
///
/// Colour never carries meaning on its own — every status chip also renders the
/// icon and the localized label, because these phones are used in sunlight.
abstract class StatusColors {
  static Color forMachineStatus(MachineStatus status) {
    return switch (status) {
      MachineStatus.inCompanyWarehouse => AppColors.neutralColor,
      MachineStatus.inBranchWarehouse => AppColors.infoColor,
      MachineStatus.withSupervisor => AppColors.infoColor,
      MachineStatus.withRepresentative => AppColors.primaryLightColor,
      MachineStatus.withMerchant => AppColors.successColor,
      MachineStatus.inTransit => AppColors.warningColor,
      MachineStatus.underMaintenance => AppColors.warningColor,
      MachineStatus.atFactory => AppColors.warningColor,
      MachineStatus.atServiceCenter => AppColors.warningColor,
      MachineStatus.replaced => AppColors.neutralColor,
      MachineStatus.decommissioned => AppColors.dangerColor,
      MachineStatus.unknown => AppColors.neutralColor,
    };
  }

  static IconData iconForMachineStatus(MachineStatus status) {
    return switch (status) {
      MachineStatus.inCompanyWarehouse => Icons.warehouse_outlined,
      MachineStatus.inBranchWarehouse => Icons.store_mall_directory_outlined,
      MachineStatus.withSupervisor => Icons.supervisor_account_outlined,
      MachineStatus.withRepresentative => Icons.badge_outlined,
      MachineStatus.withMerchant => Icons.storefront_outlined,
      MachineStatus.inTransit => Icons.local_shipping_outlined,
      MachineStatus.underMaintenance => Icons.build_outlined,
      MachineStatus.atFactory => Icons.factory_outlined,
      MachineStatus.atServiceCenter => Icons.home_repair_service_outlined,
      MachineStatus.replaced => Icons.swap_horiz_rounded,
      MachineStatus.decommissioned => Icons.block_outlined,
      MachineStatus.unknown => Icons.help_outline_rounded,
    };
  }

  static Color forTransferStatus(TransferStatus status) {
    return switch (status) {
      TransferStatus.pending => AppColors.warningColor,
      TransferStatus.confirmed => AppColors.successColor,
      TransferStatus.rejected => AppColors.dangerColor,
      TransferStatus.cancelled => AppColors.neutralColor,
      TransferStatus.unknown => AppColors.neutralColor,
    };
  }

  static IconData iconForTransferStatus(TransferStatus status) {
    return switch (status) {
      TransferStatus.pending => Icons.hourglass_empty_rounded,
      TransferStatus.confirmed => Icons.check_circle_outline_rounded,
      TransferStatus.rejected => Icons.cancel_outlined,
      TransferStatus.cancelled => Icons.remove_circle_outline_rounded,
      TransferStatus.unknown => Icons.help_outline_rounded,
    };
  }

  static Color forViolationSeverity(ViolationSeverity severity) {
    return switch (severity) {
      ViolationSeverity.low => AppColors.infoColor,
      ViolationSeverity.medium => AppColors.warningColor,
      ViolationSeverity.high => AppColors.dangerColor,
      ViolationSeverity.unknown => AppColors.neutralColor,
    };
  }

  static IconData iconForViolationSeverity(ViolationSeverity severity) {
    return switch (severity) {
      ViolationSeverity.low => Icons.info_outline_rounded,
      ViolationSeverity.medium => Icons.warning_amber_rounded,
      ViolationSeverity.high => Icons.report_gmailerrorred_rounded,
      ViolationSeverity.unknown => Icons.help_outline_rounded,
    };
  }

  static Color forBudgetStatus(BudgetStatus status) {
    return switch (status) {
      BudgetStatus.ok => AppColors.successColor,
      BudgetStatus.warning => AppColors.warningColor,
      BudgetStatus.exceeded => AppColors.dangerColor,
      BudgetStatus.unknown => AppColors.neutralColor,
    };
  }

  /// The tinted background paired with a status colour on chips and banners.
  static Color surfaceFor(Color statusColor) {
    if (statusColor == AppColors.successColor) {
      return AppColors.successSurfaceColor;
    }
    if (statusColor == AppColors.warningColor) {
      return AppColors.warningSurfaceColor;
    }
    if (statusColor == AppColors.dangerColor) {
      return AppColors.dangerSurfaceColor;
    }
    if (statusColor == AppColors.infoColor ||
        statusColor == AppColors.primaryLightColor) {
      return AppColors.infoSurfaceColor;
    }
    return AppColors.neutralSurfaceColor;
  }
}
