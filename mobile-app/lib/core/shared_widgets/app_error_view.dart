import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// Full-surface error state for a screen that has nothing to show yet.
///
/// A request that failed while content is already on screen keeps the content
/// and shows `showErrorToast` instead — this view is for the empty case only.
class AppErrorView extends StatelessWidget {
  const AppErrorView({required this.onRetry, super.key, this.message});

  final VoidCallback onRetry;
  final String? message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(
              Icons.cloud_off_rounded,
              size: 56,
              color: AppColors.neutralColor,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              LocaleKeys.errorStateTitle.tr(),
              textAlign: TextAlign.center,
              style: Styles.s17(context),
            ),
            if (message != null && message!.trim().isNotEmpty) ...<Widget>[
              const SizedBox(height: AppSpacing.sm),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: Styles.s14(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            CustomButton(
              title: LocaleKeys.tryAgain.tr(),
              isLoading: false,
              isStroked: true,
              width: 180,
              height: 48,
              onPressed: onRetry,
            ),
          ],
        ),
      ),
    );
  }
}
