import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';

/// Size-named text tokens. `height` is deliberately generous because Arabic
/// descenders collide at Latin line heights.
class Styles {
  static TextStyle s10(BuildContext context) {
    return const TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.w400,
      height: 1.5,
      color: AppColors.textPrimaryColor,
    );
  }

  static TextStyle s12(BuildContext context) {
    return const TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w400,
      height: 1.5,
      color: AppColors.textPrimaryColor,
    );
  }

  static TextStyle s13(BuildContext context) {
    return const TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w400,
      height: 1.6,
      color: AppColors.textPrimaryColor,
    );
  }

  static TextStyle s14(BuildContext context) {
    return const TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w400,
      height: 1.6,
      color: AppColors.textPrimaryColor,
    );
  }

  static TextStyle s15(BuildContext context) {
    return const TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w600,
      height: 1.5,
      color: AppColors.textPrimaryColor,
    );
  }

  static TextStyle s16(BuildContext context) {
    return const TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w400,
      height: 1.6,
      color: AppColors.textPrimaryColor,
    );
  }

  static TextStyle s17(BuildContext context) {
    return const TextStyle(
      fontSize: 17,
      fontWeight: FontWeight.w600,
      height: 1.4,
      color: AppColors.textPrimaryColor,
    );
  }

  static TextStyle s20(BuildContext context) {
    return const TextStyle(
      fontSize: 20,
      fontWeight: FontWeight.w700,
      height: 1.4,
      color: AppColors.textPrimaryColor,
    );
  }

  static TextStyle s24(BuildContext context) {
    return const TextStyle(
      fontSize: 24,
      fontWeight: FontWeight.w700,
      height: 1.4,
      color: AppColors.textPrimaryColor,
    );
  }

  /// Serials, amounts and counts. Tabular figures keep columns aligned and
  /// stop digits reflowing when a value changes.
  static TextStyle mono(BuildContext context) {
    return const TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w500,
      height: 1.5,
      color: AppColors.textPrimaryColor,
      fontFeatures: [FontFeature.tabularFigures()],
    );
  }
}
