import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// Asks for a temporary password.
///
/// The Director types it rather than the app generating one, so the value is
/// never rendered into a toast or a log line that could be screenshotted — the
/// person setting it is the only one who ever sees it here.
class ResetPasswordDialog extends StatefulWidget {
  const ResetPasswordDialog({super.key});

  static Future<String?> show(BuildContext context) {
    return showDialog<String>(
      context: context,
      builder: (_) => const ResetPasswordDialog(),
    );
  }

  @override
  State<ResetPasswordDialog> createState() => _ResetPasswordDialogState();
}

class _ResetPasswordDialogState extends State<ResetPasswordDialog> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      Navigator.of(context).pop(_controller.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppColors.surfaceColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                LocaleKeys.userResetPasswordTitle.tr(),
                textAlign: TextAlign.center,
                style: Styles.s17(context),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                LocaleKeys.userResetPasswordMessage.tr(),
                textAlign: TextAlign.center,
                style: Styles.s13(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
              ),
              const SizedBox(height: AppSpacing.lg),
              LabeledTextFormField(
                controller: _controller,
                label: LocaleKeys.newPassword.tr(),
                hintText: LocaleKeys.newPassword.tr(),
                keyboardType: TextInputType.visiblePassword,
                textInputAction: TextInputAction.done,
                identifier: 'reset_password_field',
                isPassword: true,
                validation: AppValidators.isValidPassword,
                onFieldSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: AppSpacing.lg),
              CustomButton(
                title: LocaleKeys.save.tr(),
                isLoading: false,
                height: 48,
                identifier: 'reset_password_submit',
                onPressed: _submit,
              ),
              const SizedBox(height: AppSpacing.sm),
              CustomButton(
                title: LocaleKeys.cancel.tr(),
                isLoading: false,
                isStroked: true,
                height: 48,
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
