import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/services/sync/sync_operation_type.dart';
import 'package:machinery/core/shared_widgets/sync_status_badge.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/sync/data/logic/sync_queue_state.dart';

class SyncQueueTile extends StatelessWidget {
  const SyncQueueTile({
    required this.display,
    required this.onTap,
    required this.onRetry,
    required this.onDelete,
    super.key,
  });

  final SyncQueueDisplayItem display;
  final VoidCallback onTap;
  final VoidCallback onRetry;
  final VoidCallback onDelete;

  String get _typeLabel => switch (display.item.type) {
    SyncOperationType.createTransfer => LocaleKeys.syncItemTypeCreateTransfer.tr(),
    SyncOperationType.confirmTransfer => LocaleKeys.syncItemTypeConfirmTransfer.tr(),
    SyncOperationType.rejectTransfer => LocaleKeys.syncItemTypeRejectTransfer.tr(),
    SyncOperationType.createMerchant => LocaleKeys.syncItemTypeCreateMerchant.tr(),
    SyncOperationType.createSubscription =>
      LocaleKeys.syncItemTypeCreateSubscription.tr(),
    SyncOperationType.createFinanceTransaction =>
      LocaleKeys.syncItemTypeCreateFinanceTransaction.tr(),
  };

  @override
  Widget build(BuildContext context) {
    final bool canRetry = display.item.status == SyncItemStatus.failed;
    final bool canDelete =
        display.item.status == SyncItemStatus.failed || display.item.status == SyncItemStatus.conflict;

    return InkWell(
      onTap: display.item.status == SyncItemStatus.conflict ? onTap : null,
      child: Padding(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(_typeLabel, style: Styles.s14(context).copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    children: <Widget>[
                      if (display.isBlockedOnMedia)
                        Padding(
                          padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
                          child: StatusChipLabel(text: LocaleKeys.syncBlocked.tr()),
                        )
                      else
                        SyncStatusBadge(status: display.item.status),
                    ],
                  ),
                  if (display.item.errorMessage != null) ...<Widget>[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      display.item.errorMessage!,
                      style: Styles.s12(context).copyWith(color: AppColors.textSecondaryColor),
                    ),
                  ],
                  if (display.item.attemptCount > 0) ...<Widget>[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      LocaleKeys.syncAttemptsCount.tr(args: <String>['${display.item.attemptCount}']),
                      style: Styles.s12(context).copyWith(color: AppColors.textSecondaryColor),
                    ),
                  ],
                ],
              ),
            ),
            if (canRetry)
              IconButton(
                icon: const Icon(Icons.refresh_rounded),
                tooltip: LocaleKeys.syncRetryNow.tr(),
                onPressed: onRetry,
              ),
            if (canDelete)
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded, color: AppColors.dangerColor),
                tooltip: LocaleKeys.syncDeleteItem.tr(),
                onPressed: onDelete,
              ),
          ],
        ),
      ),
    );
  }
}

/// A minimal inline chip for the one display-only state (`blocked`) that has
/// no place in the persisted `SyncItemStatus` enum `SyncStatusBadge` reads.
class StatusChipLabel extends StatelessWidget {
  const StatusChipLabel({required this.text, super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: AppColors.infoColor.withValues(alpha: .10),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const Icon(Icons.hourglass_bottom_rounded, size: 14, color: AppColors.infoColor),
          const SizedBox(width: AppSpacing.xs),
          Text(
            text,
            style: Styles.s12(context).copyWith(color: AppColors.infoColor, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
