import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

class PasswordStrengthIndicator extends StatelessWidget {
  const PasswordStrengthIndicator({required this.password, super.key});

  final String password;

  @override
  Widget build(BuildContext context) {
    if (password.isEmpty) {
      return const SizedBox.shrink();
    }

    final int score = _score;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: List<Widget>.generate(4, (index) {
            return Expanded(
              child: Container(
                height: 4,
                margin: EdgeInsetsDirectional.only(
                  end: index == 3 ? 0 : AppSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: index < score ? _color : AppColors.surfaceAltColor,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          _labelKey.tr(),
          style: Styles.s12(context).copyWith(color: _color),
        ),
      ],
    );
  }

  int get _score {
    int score = 0;
    if (password.length >= 8) {
      score++;
    }
    if (password.length >= 12) {
      score++;
    }
    if (RegExp(r'[A-Za-z]').hasMatch(password) &&
        RegExp(r'\d').hasMatch(password)) {
      score++;
    }
    if (RegExp(r'[^A-Za-z0-9]').hasMatch(password)) {
      score++;
    }
    return score;
  }

  Color get _color => switch (_score) {
    <= 1 => AppColors.dangerColor,
    2 => AppColors.warningColor,
    3 => AppColors.infoColor,
    _ => AppColors.successColor,
  };

  String get _labelKey => switch (_score) {
    <= 1 => LocaleKeys.passwordStrengthWeak,
    2 => LocaleKeys.passwordStrengthFair,
    3 => LocaleKeys.passwordStrengthGood,
    _ => LocaleKeys.passwordStrengthStrong,
  };
}
