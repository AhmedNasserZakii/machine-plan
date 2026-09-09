import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/auth/presentation/widgets/password_field.dart';
import 'package:machinery/feature/auth/presentation/widgets/password_strength_indicator.dart';

class ChangePasswordForm extends StatelessWidget {
  const ChangePasswordForm({
    required this.currentPasswordController,
    required this.newPasswordController,
    required this.confirmPasswordController,
    required this.onChanged,
    required this.onSubmitted,
    super.key,
    this.fieldErrors = const <String, String>{},
  });

  final TextEditingController currentPasswordController;
  final TextEditingController newPasswordController;
  final TextEditingController confirmPasswordController;
  final VoidCallback onChanged;
  final VoidCallback onSubmitted;
  final Map<String, String> fieldErrors;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        PasswordField(
          controller: currentPasswordController,
          labelKey: LocaleKeys.currentPassword,
          textInputAction: TextInputAction.next,
          errorText: fieldErrors['currentPassword'],
          onChanged: (_) => onChanged(),
          identifier: 'current_password_field',
        ),
        const SizedBox(height: AppSpacing.md),
        PasswordField(
          controller: newPasswordController,
          labelKey: LocaleKeys.newPassword,
          textInputAction: TextInputAction.next,
          errorText: fieldErrors['newPassword'],
          onChanged: (_) => onChanged(),
          identifier: 'new_password_field',
        ),
        const SizedBox(height: AppSpacing.sm),
        PasswordStrengthIndicator(password: newPasswordController.text),
        const SizedBox(height: AppSpacing.md),
        PasswordField(
          controller: confirmPasswordController,
          labelKey: LocaleKeys.confirmPassword,
          validation: (value) => AppValidators.isValidConfirmPassword(
            newPasswordController.text,
            value,
          ),
          onChanged: (_) => onChanged(),
          onFieldSubmitted: (_) => onSubmitted(),
          identifier: 'confirm_password_field',
        ),
      ],
    );
  }
}
