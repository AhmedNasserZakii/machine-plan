import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

class BiometricLoginButton extends StatelessWidget {
  const BiometricLoginButton({
    required this.onPressed,
    required this.isLoading,
    super.key,
  });

  final VoidCallback onPressed;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return CustomButton(
      title: LocaleKeys.loginWithBiometric.tr(),
      isLoading: isLoading,
      isStroked: true,
      onPressed: onPressed,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          const Icon(
            Icons.fingerprint_rounded,
            size: 22,
            color: AppColors.primaryColor,
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            LocaleKeys.loginWithBiometric.tr(),
            style: Styles.s15(context).copyWith(color: AppColors.primaryColor),
          ),
        ],
      ),
    );
  }
}
