import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

class AppConfirmDialog extends StatelessWidget {
  const AppConfirmDialog({
    required this.title,
    required this.description,
    super.key,
    this.confirmLabel,
    this.cancelLabel,
    this.isDestructive = false,
    this.icon,
    this.confirmIdentifier,
    this.cancelIdentifier,
  });

  final String title;
  final String description;
  final String? confirmLabel;
  final String? cancelLabel;
  final bool isDestructive;
  final IconData? icon;

  /// The confirm label often repeats the label of the control that opened the
  /// dialog, so the end-to-end suite needs ids to tell them apart.
  final String? confirmIdentifier;
  final String? cancelIdentifier;

  static Future<bool> show({
    required BuildContext context,
    required String title,
    required String description,
    String? confirmLabel,
    String? cancelLabel,
    bool isDestructive = false,
    IconData? icon,
    String? confirmIdentifier,
    String? cancelIdentifier,
  }) async {
    final bool? result = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (_) => AppConfirmDialog(
        title: title,
        description: description,
        confirmLabel: confirmLabel,
        cancelLabel: cancelLabel,
        isDestructive: isDestructive,
        icon: icon,
        confirmIdentifier: confirmIdentifier,
        cancelIdentifier: cancelIdentifier,
      ),
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final Color accent = isDestructive
        ? AppColors.dangerColor
        : AppColors.primaryColor;

    return Dialog(
      backgroundColor: AppColors.surfaceColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: .10),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon ??
                    (isDestructive
                        ? Icons.warning_amber_rounded
                        : Icons.help_outline_rounded),
                size: 32,
                color: accent,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Styles.s17(context),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              description,
              textAlign: TextAlign.center,
              style: Styles.s14(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
            const SizedBox(height: AppSpacing.lg),
            CustomButton(
              title: confirmLabel ?? LocaleKeys.confirm.tr(),
              isLoading: false,
              backgroundColor: accent,
              height: 48,
              identifier: confirmIdentifier,
              onPressed: () => Navigator.of(context).pop(true),
            ),
            const SizedBox(height: AppSpacing.sm),
            CustomButton(
              title: cancelLabel ?? LocaleKeys.cancel.tr(),
              isLoading: false,
              isStroked: true,
              height: 48,
              identifier: cancelIdentifier,
              onPressed: () => Navigator.of(context).pop(false),
            ),
          ],
        ),
      ),
    );
  }
}
