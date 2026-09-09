import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:machinery/core/shared_widgets/custom_text_form_field.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

class LabeledTextFormField extends StatelessWidget {
  const LabeledTextFormField({
    required this.label,
    required this.hintText,
    super.key,
    this.keyboardType = TextInputType.text,
    this.textInputAction = TextInputAction.next,
    this.maxLines = 1,
    this.controller,
    this.isPassword = false,
    this.validation,
    this.onChanged,
    this.onFieldSubmitted,
    this.inputFormatters,
    this.maxLength,
    this.errorText,
    this.textDirection,
    this.prefixIcon,
    this.suffixIcon,
    this.identifier,
  });

  final String label;
  final String hintText;
  final TextInputType keyboardType;
  final TextInputAction textInputAction;

  /// Free-text notes and reasons need room; everything else is a single line.
  final int maxLines;
  final TextEditingController? controller;
  final bool isPassword;
  final String? Function(String?)? validation;
  final void Function(String)? onChanged;
  final void Function(String)? onFieldSubmitted;
  final List<TextInputFormatter>? inputFormatters;
  final int? maxLength;
  final String? errorText;
  final TextDirection? textDirection;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final String? identifier;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: Styles.s14(context).copyWith(
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondaryColor,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        CustomTextFormField(
          controller: controller,
          hintText: hintText,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          maxLines: maxLines,
          isPassword: isPassword,
          validation: validation,
          onChanged: onChanged,
          onFieldSubmitted: onFieldSubmitted,
          inputFormatters: inputFormatters,
          maxLength: maxLength,
          errorText: errorText,
          textDirection: textDirection,
          prefixIcon: prefixIcon,
          suffixIcon: suffixIcon,
          identifier: identifier,
        ),
      ],
    );
  }
}
