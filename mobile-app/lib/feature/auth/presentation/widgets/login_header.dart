import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

class LoginHeader extends StatelessWidget {
  const LoginHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: AppColors.primaryColor,
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: const Icon(
            Icons.precision_manufacturing_rounded,
            size: 40,
            color: AppColors.textOnPrimaryColor,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(LocaleKeys.loginTitle.tr(), style: Styles.s24(context)),
        const SizedBox(height: AppSpacing.xs),
        Text(
          LocaleKeys.loginSubtitle.tr(),
          style: Styles.s14(
            context,
          ).copyWith(color: AppColors.textSecondaryColor),
        ),
      ],
    );
  }
}
