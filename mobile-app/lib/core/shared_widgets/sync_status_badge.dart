import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/status_chip.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/utils/enums.dart';

/// Marks a record that exists locally but has not been accepted by the server
/// yet, so nobody mistakes a queued hand-off for a confirmed one.
class SyncStatusBadge extends StatelessWidget {
  const SyncStatusBadge({required this.status, super.key});

  final SyncItemStatus status;

  @override
  Widget build(BuildContext context) {
    if (status == SyncItemStatus.synced) {
      return const SizedBox.shrink();
    }

    return StatusChip(label: _label, color: _color, icon: _icon);
  }

  String get _label => switch (status) {
    SyncItemStatus.pending => LocaleKeys.syncPending.tr(),
    SyncItemStatus.inFlight => LocaleKeys.syncPending.tr(),
    SyncItemStatus.failed => LocaleKeys.syncFailed.tr(),
    SyncItemStatus.conflict => LocaleKeys.syncConflict.tr(),
    SyncItemStatus.synced => LocaleKeys.syncSynced.tr(),
  };

  Color get _color => switch (status) {
    SyncItemStatus.pending => AppColors.warningColor,
    SyncItemStatus.inFlight => AppColors.infoColor,
    SyncItemStatus.failed => AppColors.dangerColor,
    SyncItemStatus.conflict => AppColors.dangerColor,
    SyncItemStatus.synced => AppColors.successColor,
  };

  IconData get _icon => switch (status) {
    SyncItemStatus.pending => Icons.schedule_rounded,
    SyncItemStatus.inFlight => Icons.sync_rounded,
    SyncItemStatus.failed => Icons.sync_problem_rounded,
    SyncItemStatus.conflict => Icons.report_gmailerrorred_rounded,
    SyncItemStatus.synced => Icons.cloud_done_outlined,
  };
}
