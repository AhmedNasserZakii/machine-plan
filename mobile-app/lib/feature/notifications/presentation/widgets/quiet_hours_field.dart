import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// Quiet hours are server-global (default 21:00–08:00), not per-user editable.
/// Critical templates ignore them — say so here so it is not a surprise.
class QuietHoursField extends StatelessWidget {
  const QuietHoursField({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surfaceAltColor,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              const Icon(
                Icons.nightlight_round,
                size: 20,
                color: AppColors.textSecondaryColor,
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                LocaleKeys.notificationsQuietHoursTitle.tr(),
                style: Styles.s15(context).copyWith(fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            LocaleKeys.notificationsQuietHoursBody.tr(),
            style: Styles.s13(context).copyWith(
              color: AppColors.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            LocaleKeys.notificationsQuietHoursExceptions.tr(),
            style: Styles.s12(context).copyWith(
              color: AppColors.textSecondaryColor,
            ),
          ),
        ],
      ),
    );
  }
}
