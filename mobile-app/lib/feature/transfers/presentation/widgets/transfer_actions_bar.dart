import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';

/// The action bar under a pending transfer.
///
/// Accepting is the primary action and rejecting is not a button of equal
/// weight, because refusing a whole delivery over one bad machine is the
/// mistake this screen exists to prevent.
class TransferActionsBar extends StatelessWidget {
  const TransferActionsBar({
    required this.isBusy,
    this.onConfirm,
    this.onReject,
    this.onCancel,
    super.key,
  });

  final bool isBusy;
  final VoidCallback? onConfirm;
  final VoidCallback? onReject;

  /// Only the sender may withdraw, and only inside the cancel window. The
  /// server has the final say; this just offers it.
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: const BoxDecoration(
          color: AppColors.surfaceColor,
          border: Border(top: BorderSide(color: AppColors.borderColor)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            if (onConfirm != null)
              CustomButton(
                title: LocaleKeys.transferActionConfirm.tr(),
                isLoading: isBusy,
                height: 48,
                width: double.infinity,
                identifier: 'transfer_confirm_button',
                onPressed: isBusy ? null : onConfirm,
              ),
            if (onConfirm != null && (onReject != null || onCancel != null))
              const SizedBox(height: AppSpacing.sm),
            Row(
              children: <Widget>[
                if (onReject != null)
                  Expanded(
                    child: CustomButton(
                      title: LocaleKeys.transferActionReject.tr(),
                      isLoading: false,
                      isStroked: true,
                      height: 44,
                      foregroundColor: AppColors.dangerColor,
                      identifier: 'transfer_reject_button',
                      onPressed: isBusy ? null : onReject,
                    ),
                  ),
                if (onReject != null && onCancel != null)
                  const SizedBox(width: AppSpacing.sm),
                if (onCancel != null)
                  Expanded(
                    child: CustomButton(
                      title: LocaleKeys.transferActionCancel.tr(),
                      isLoading: false,
                      isStroked: true,
                      height: 44,
                      identifier: 'transfer_cancel_button',
                      onPressed: isBusy ? null : onCancel,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
