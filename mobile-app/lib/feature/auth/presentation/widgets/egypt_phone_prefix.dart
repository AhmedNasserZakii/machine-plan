import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// Fixed Egypt country chip shown beside every mobile phone field.
///
/// Always laid out left-to-right so the flag stays on the left of `+20`
/// even when the surrounding Arabic screen is RTL.
///
/// The dial code is decorative — the field still stores the local number
/// (`01…` / `1…`) that [AppValidators.normalizeEgyptianPhone] already accepts.
class EgyptPhonePrefix extends StatelessWidget {
  const EgyptPhonePrefix({super.key});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Padding(
        padding: const EdgeInsets.only(
          left: AppSpacing.md,
          right: AppSpacing.sm,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Text('🇪🇬', style: TextStyle(fontSize: 18, height: 1)),
            const SizedBox(width: AppSpacing.xs),
            Text(
              '+20',
              style: Styles.s14(context).copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondaryColor,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Container(
              width: 1,
              height: 20,
              color: AppColors.borderColor,
            ),
          ],
        ),
      ),
    );
  }
}
