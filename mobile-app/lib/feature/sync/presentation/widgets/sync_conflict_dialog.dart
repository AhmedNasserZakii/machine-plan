import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/services/sync/sync_queue_item.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';

/// The plan's `07` example dialog, made real:
///
/// > العملية دي مش قادرة تتسجل
/// > الماكينة SN-00341 اتنقلت لحد تاني وإنت مش متصل بالنت.
/// > الوضع الحالي: مع المندوب محمد علي.
/// > [عرض التفاصيل] [حذف العملية]
///
/// Never a snackbar, never auto-dismissed, and never resolved by retrying —
/// the server already won this argument (`batch-outcome.ts`: a conflict is
/// always `MANUAL`). The only actions are seeing what the server actually
/// holds (shown inline, in the body — there is no separate details screen to
/// route to) and deleting the local operation.
class SyncConflictDialog {
  /// Returns `true` if the representative chose to delete the operation.
  static Future<bool> show({required BuildContext context, required SyncQueueItem item}) {
    return AppConfirmDialog.show(
      context: context,
      title: LocaleKeys.syncConflictDialogTitle.tr(),
      description: _body(item),
      confirmLabel: LocaleKeys.syncConflictDismiss.tr(),
      cancelLabel: LocaleKeys.syncConflictViewDetails.tr(),
      isDestructive: true,
      icon: Icons.report_gmailerrorred_rounded,
      confirmIdentifier: 'sync_conflict_delete_button',
      cancelIdentifier: 'sync_conflict_dismiss_button',
    );
  }

  static String _body(SyncQueueItem item) {
    final StringBuffer buffer = StringBuffer(LocaleKeys.syncConflictDialogBody.tr());

    if (item.errorMessage != null && item.errorMessage!.trim().isNotEmpty) {
      buffer
        ..writeln()
        ..write(item.errorMessage);
    }

    final Map<String, dynamic>? state = item.serverState;
    if (state != null) {
      final Map<String, dynamic>? transfer = state['transfer'] as Map<String, dynamic>?;
      if (transfer != null) {
        buffer
          ..writeln()
          ..write('${transfer['status'] ?? ''}');
      }

      final List<dynamic>? machines = state['machines'] as List<dynamic>?;
      if (machines != null) {
        for (final dynamic machine in machines) {
          if (machine is Map<String, dynamic>) {
            buffer
              ..writeln()
              ..write('${machine['serial'] ?? ''}: ${machine['status'] ?? ''}');
          }
        }
      }
    }

    return buffer.toString();
  }
}
