import 'package:flutter/material.dart';
import 'package:loading_animation_widget/loading_animation_widget.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

class CustomButton extends StatelessWidget {
  const CustomButton({
    required this.title,
    required this.isLoading,
    super.key,
    this.onPressed,
    this.isStroked = false,
    this.backgroundColor,
    this.foregroundColor,
    this.width,
    this.height,
    this.borderRadius,
    this.padding,
    this.style,
    this.child,
    this.identifier,
  });

  final String title;
  final bool isLoading;
  final void Function()? onPressed;
  final bool isStroked;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final double? width;
  final double? height;
  final double? borderRadius;
  final EdgeInsetsGeometry? padding;
  final TextStyle? style;
  final Widget? child;

  /// Stable accessibility id, matched by the end-to-end suite.
  final String? identifier;

  @override
  Widget build(BuildContext context) {
    final bool isDisabled = onPressed == null;
    final Color resolvedBackground = isStroked
        ? AppColors.surfaceColor
        : backgroundColor ?? AppColors.primaryColor;
    final BorderSide resolvedBorder = isStroked
        ? BorderSide(
            color: isDisabled ? AppColors.borderColor : AppColors.primaryColor,
            width: 1,
          )
        : BorderSide.none;

    final Widget button = SizedBox(
      width: width ?? double.infinity,
      height: height ?? 56,
      child: ElevatedButton(
        onPressed: isDisabled || isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          padding: padding,
          alignment: Alignment.center,
          backgroundColor: resolvedBackground,
          disabledBackgroundColor: isStroked
              ? AppColors.surfaceColor
              : AppColors.disabledButtonColor,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius ?? AppRadius.md),
            side: resolvedBorder,
          ),
        ),
        child: isLoading
            ? Center(
                child: LoadingAnimationWidget.fallingDot(
                  color: isStroked
                      ? AppColors.primaryColor
                      : AppColors.textOnPrimaryColor,
                  size: 30,
                ),
              )
            : child ??
                  Center(
                    child: Text(
                      title,
                      style:
                          style ??
                          Styles.s15(context).copyWith(
                            color: isDisabled
                                ? AppColors.textDisabledColor
                                : foregroundColor ??
                                      (isStroked
                                          ? AppColors.primaryColor
                                          : AppColors.textOnPrimaryColor),
                          ),
                    ),
                  ),
      ),
    );

    if (identifier == null) {
      return button;
    }

    // `enabled` is exposed so a flow can assert the button is genuinely
    // disabled rather than just tapping it and hoping nothing happened.
    return Semantics(
      identifier: identifier,
      enabled: !isDisabled && !isLoading,
      child: button,
    );
  }
}
