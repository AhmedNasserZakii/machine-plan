import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// Offered once, right after a successful password login.
class BiometricEnrollSheet extends StatelessWidget {
  const BiometricEnrollSheet({super.key});

  static Future<bool> show(BuildContext context) async {
    final bool? accepted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const BiometricEnrollSheet(),
    );
    return accepted ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: AppColors.infoSurfaceColor,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.fingerprint_rounded,
                size: 40,
                color: AppColors.primaryColor,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              LocaleKeys.biometricEnrollTitle.tr(),
              style: Styles.s17(context),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              LocaleKeys.biometricEnrollMessage.tr(),
              textAlign: TextAlign.center,
              style: Styles.s14(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
            const SizedBox(height: AppSpacing.lg),
            CustomButton(
              title: LocaleKeys.biometricEnrollConfirm.tr(),
              isLoading: false,
              onPressed: () => Navigator.of(context).pop(true),
            ),
            const SizedBox(height: AppSpacing.sm),
            CustomButton(
              title: LocaleKeys.biometricEnrollDismiss.tr(),
              isLoading: false,
              isStroked: true,
              onPressed: () => Navigator.of(context).pop(false),
            ),
          ],
        ),
      ),
    );
  }
}
