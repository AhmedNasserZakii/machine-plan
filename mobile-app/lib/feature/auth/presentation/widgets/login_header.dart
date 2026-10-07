import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_logo.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

class LoginHeader extends StatelessWidget {
  const LoginHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: <Widget>[
        const AppLogo(),
        const SizedBox(height: AppSpacing.sm),
        Text(LocaleKeys.appName.tr(), style: Styles.s24(context)),
        const SizedBox(height: AppSpacing.lg),
        Text(
          LocaleKeys.loginTitle.tr(),
          textAlign: TextAlign.center,
          style: Styles.s24(context),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          LocaleKeys.loginSubtitle.tr(),
          textAlign: TextAlign.center,
          style: Styles.s14(
            context,
          ).copyWith(color: AppColors.textSecondaryColor),
        ),
      ],
    );
  }
}
