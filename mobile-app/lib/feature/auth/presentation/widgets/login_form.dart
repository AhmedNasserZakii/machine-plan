import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/auth/presentation/widgets/password_field.dart';
import 'package:machinery/feature/auth/presentation/widgets/phone_field.dart';

/// Presentational only: it receives controllers, callbacks and server-side
/// field errors. Submission lives in the screen.
class LoginForm extends StatelessWidget {
  const LoginForm({
    required this.phoneController,
    required this.passwordController,
    required this.onChanged,
    required this.onSubmitted,
    super.key,
    this.fieldErrors = const <String, String>{},
  });

  final TextEditingController phoneController;
  final TextEditingController passwordController;
  final VoidCallback onChanged;
  final VoidCallback onSubmitted;
  final Map<String, String> fieldErrors;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        PhoneField(
          controller: phoneController,
          errorText: fieldErrors['phone'],
          onChanged: (_) => onChanged(),
          identifier: 'login_phone_field',
        ),
        const SizedBox(height: AppSpacing.md),
        PasswordField(
          controller: passwordController,
          errorText: fieldErrors['password'],
          onChanged: (_) => onChanged(),
          onFieldSubmitted: (_) => onSubmitted(),
          identifier: 'login_password_field',
        ),
      ],
    );
  }
}
