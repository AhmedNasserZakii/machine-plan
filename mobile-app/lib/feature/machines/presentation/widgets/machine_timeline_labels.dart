import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/feature/machines/domain/entities/machine_timeline_event.dart';

/// One place that turns a raw event type into what the timeline page shows —
/// a sentence, an icon, a color — mirroring `MachineLabels` for machine status.
abstract class MachineTimelineLabels {
  static String title(MachineTimelineEventType type) {
    return switch (type) {
      MachineTimelineEventType.transferPending =>
        LocaleKeys.timelineTransferPending,
      MachineTimelineEventType.transferConfirmed =>
        LocaleKeys.timelineTransferConfirmed,
      MachineTimelineEventType.transferRejected =>
        LocaleKeys.timelineTransferRejected,
      MachineTimelineEventType.transferCancelled =>
        LocaleKeys.timelineTransferCancelled,
      MachineTimelineEventType.maintenanceOpened =>
        LocaleKeys.timelineMaintenanceOpened,
      MachineTimelineEventType.maintenanceClosed =>
        LocaleKeys.timelineMaintenanceClosed,
      MachineTimelineEventType.violationCreated =>
        LocaleKeys.timelineViolationCreated,
      MachineTimelineEventType.machineReplaced =>
        LocaleKeys.timelineMachineReplaced,
      MachineTimelineEventType.decommissioned =>
        LocaleKeys.timelineDecommissioned,
      MachineTimelineEventType.decommissionReverted =>
        LocaleKeys.timelineDecommissionReverted,
      MachineTimelineEventType.unknown => LocaleKeys.timelineUnknown,
    }.tr();
  }

  static IconData icon(MachineTimelineEventType type) {
    return switch (type) {
      MachineTimelineEventType.transferPending => Icons.hourglass_top_rounded,
      MachineTimelineEventType.transferConfirmed => Icons.swap_horiz_rounded,
      MachineTimelineEventType.transferRejected => Icons.cancel_outlined,
      MachineTimelineEventType.transferCancelled => Icons.undo_rounded,
      MachineTimelineEventType.maintenanceOpened => Icons.build_rounded,
      MachineTimelineEventType.maintenanceClosed => Icons.build_circle_rounded,
      MachineTimelineEventType.violationCreated => Icons.gavel_rounded,
      MachineTimelineEventType.machineReplaced => Icons.change_circle_outlined,
      MachineTimelineEventType.decommissioned => Icons.delete_forever_rounded,
      MachineTimelineEventType.decommissionReverted => Icons.restore_rounded,
      MachineTimelineEventType.unknown => Icons.circle_outlined,
    };
  }

  static Color color(MachineTimelineEventType type) {
    return switch (type) {
      MachineTimelineEventType.transferPending => AppColors.warningColor,
      MachineTimelineEventType.transferConfirmed => AppColors.infoColor,
      MachineTimelineEventType.transferRejected => AppColors.dangerColor,
      MachineTimelineEventType.transferCancelled => AppColors.neutralColor,
      MachineTimelineEventType.maintenanceOpened => AppColors.warningColor,
      MachineTimelineEventType.maintenanceClosed => AppColors.successColor,
      MachineTimelineEventType.violationCreated => AppColors.dangerColor,
      MachineTimelineEventType.machineReplaced => AppColors.primaryColor,
      MachineTimelineEventType.decommissioned => AppColors.dangerColor,
      MachineTimelineEventType.decommissionReverted => AppColors.successColor,
      MachineTimelineEventType.unknown => AppColors.neutralColor,
    };
  }
}
