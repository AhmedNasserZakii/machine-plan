import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/shared_widgets/labeled_text_form_field.dart';

class PasswordField extends StatelessWidget {
  const PasswordField({
    required this.controller,
    super.key,
    this.labelKey,
    this.textInputAction = TextInputAction.done,
    this.validation,
    this.onChanged,
    this.onFieldSubmitted,
    this.errorText,
    this.identifier,
  });

  final TextEditingController controller;
  final String? labelKey;
  final TextInputAction textInputAction;
  final String? Function(String?)? validation;
  final void Function(String)? onChanged;
  final void Function(String)? onFieldSubmitted;
  final String? errorText;
  final String? identifier;

  @override
  Widget build(BuildContext context) {
    return LabeledTextFormField(
      label: (labelKey ?? LocaleKeys.password).tr(),
      hintText: '••••••••',
      keyboardType: TextInputType.visiblePassword,
      textInputAction: textInputAction,
      controller: controller,
      isPassword: true,
      validation: validation ?? AppValidators.isValidPassword,
      onChanged: onChanged,
      onFieldSubmitted: onFieldSubmitted,
      errorText: errorText,
      identifier: identifier,
      prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
    );
  }
}
