import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';

abstract class AppThemes {
  /// Cairo covers Arabic and Latin from one family, so switching locale does
  /// not switch typeface mid-screen.
  static final ThemeData lightTheme = ThemeData(
    brightness: Brightness.light,
    useMaterial3: true,
    primaryColor: AppColors.primaryColor,
    scaffoldBackgroundColor: AppColors.scaffoldBackgroundColor,
    dividerColor: AppColors.dividerColor,
    textTheme: GoogleFonts.cairoTextTheme(ThemeData.light().textTheme),
    colorScheme: const ColorScheme.light(
      primary: AppColors.primaryColor,
      secondary: AppColors.secondaryColor,
      surface: AppColors.surfaceColor,
      error: AppColors.dangerColor,
      onPrimary: AppColors.textOnPrimaryColor,
      onSurface: AppColors.textPrimaryColor,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.surfaceColor,
      foregroundColor: AppColors.textPrimaryColor,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: true,
    ),
    cardTheme: const CardThemeData(
      color: AppColors.surfaceColor,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.surfaceColor,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.dividerColor,
      thickness: 1,
      space: 1,
    ),
    // 48 dp minimum on every tappable element: this app is used one-handed,
    // standing, sometimes with gloves on.
    materialTapTargetSize: MaterialTapTargetSize.padded,
  );
}
