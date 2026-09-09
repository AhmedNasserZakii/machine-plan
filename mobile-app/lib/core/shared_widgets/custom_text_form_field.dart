import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/shared_widgets/password_visibility_icon.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

class CustomTextFormField extends StatefulWidget {
  const CustomTextFormField({
    super.key,
    this.controller,
    this.hintText,
    this.maxLines,
    this.suffixIcon,
    this.prefixIcon,
    this.readOnly,
    this.onTap,
    this.keyboardType,
    this.validation,
    this.borderColor,
    this.onChanged,
    this.isPassword = false,
    this.inputFormatters,
    this.maxLength,
    this.focusNode,
    this.style,
    this.onFieldSubmitted,
    this.textInputAction,
    this.borderRadius,
    this.fillColor,
    this.contentPadding,
    this.errorText,
    this.textDirection,
    this.identifier,
  });

  final TextEditingController? controller;
  final String? hintText;
  final int? maxLines;
  final Widget? suffixIcon;
  final Widget? prefixIcon;
  final bool? readOnly;
  final void Function()? onTap;
  final TextInputType? keyboardType;
  final String? Function(String?)? validation;
  final Color? borderColor;
  final void Function(String)? onChanged;
  final bool isPassword;
  final List<TextInputFormatter>? inputFormatters;
  final int? maxLength;
  final FocusNode? focusNode;
  final TextStyle? style;
  final void Function(String)? onFieldSubmitted;
  final TextInputAction? textInputAction;
  final double? borderRadius;
  final Color? fillColor;
  final EdgeInsetsGeometry? contentPadding;

  /// Server-side field error, surfaced inline under the field.
  final String? errorText;

  /// Force LTR for serials, phone numbers and amounts inside an RTL layout.
  final TextDirection? textDirection;

  /// Stable accessibility id. Also what the end-to-end suite matches on, so
  /// flows keep working when the visible label is translated.
  final String? identifier;

  @override
  State<CustomTextFormField> createState() => _CustomTextFormFieldState();
}

class _CustomTextFormFieldState extends State<CustomTextFormField> {
  late bool _obscureText = widget.isPassword;

  @override
  Widget build(BuildContext context) {
    final double radius = widget.borderRadius ?? AppRadius.md;

    final Widget field = TextFormField(
      onTapOutside: (_) => FocusScope.of(context).unfocus(),
      obscureText: _obscureText,
      obscuringCharacter: '*',
      maxLines: widget.isPassword ? 1 : widget.maxLines ?? 1,
      onChanged: widget.onChanged,
      controller: widget.controller,
      readOnly: widget.readOnly ?? false,
      cursorColor: AppColors.primaryColor,
      focusNode: widget.focusNode,
      onTap: widget.onTap,
      textDirection: widget.textDirection,
      textInputAction: widget.textInputAction,
      style: widget.style ?? Styles.s16(context),
      maxLength: widget.maxLength,
      validator: widget.validation,
      keyboardType: widget.keyboardType,
      inputFormatters: widget.inputFormatters,
      onFieldSubmitted: widget.onFieldSubmitted,
      decoration: InputDecoration(
        counterText: '',
        errorText: widget.errorText,
        filled: true,
        fillColor: widget.fillColor ?? AppColors.surfaceColor,
        hintText: widget.hintText,
        hintStyle: Styles.s14(
          context,
        ).copyWith(color: AppColors.textPlaceholderColor),
        contentPadding:
            widget.contentPadding ??
            const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: 14,
            ),
        prefixIcon: widget.prefixIcon,
        suffixIcon: widget.isPassword
            ? ClickedWidget(
                onTap: () => setState(() => _obscureText = !_obscureText),
                child: Padding(
                  padding: const EdgeInsetsDirectional.all(12),
                  child: PasswordVisibilityIcon(isVisible: !_obscureText),
                ),
              )
            : widget.suffixIcon,
        border: _border(radius, widget.borderColor ?? AppColors.borderColor),
        enabledBorder: _border(
          radius,
          widget.borderColor ?? AppColors.borderColor,
        ),
        focusedBorder: _border(radius, AppColors.primaryColor),
        errorBorder: _border(radius, AppColors.dangerColor),
        focusedErrorBorder: _border(radius, AppColors.dangerColor),
      ),
    );

    if (widget.identifier == null) {
      return field;
    }

    return Semantics(identifier: widget.identifier, child: field);
  }

  OutlineInputBorder _border(double radius, Color color) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(radius),
      borderSide: BorderSide(color: color),
    );
  }
}
