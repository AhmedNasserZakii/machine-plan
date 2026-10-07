import 'package:flutter/material.dart';
import 'package:machinery/core/shared_widgets/app_symbol_3d.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';

abstract class AppThemes {
  static const _actionShape = RoundedRectangleBorder(
    borderRadius: BorderRadius.all(Radius.circular(AppRadius.md)),
  );

  static const _fieldBorder = OutlineInputBorder(
    borderRadius: BorderRadius.all(Radius.circular(AppRadius.md)),
    borderSide: BorderSide(color: AppColors.borderColor),
  );

  /// Cairo covers Arabic and Latin from one family, so switching locale does
  /// not switch typeface mid-screen.
  static final ThemeData lightTheme = ThemeData(
    brightness: Brightness.light,
    useMaterial3: true,
    actionIconTheme: ActionIconThemeData(
      backButtonIconBuilder: (_) => const AppSymbol3d(Icons.arrow_back_rounded),
      closeButtonIconBuilder: (_) => const AppSymbol3d(Icons.close_rounded),
      drawerButtonIconBuilder: (_) => const AppSymbol3d(Icons.menu_rounded),
      endDrawerButtonIconBuilder: (_) => const AppSymbol3d(Icons.menu_rounded),
    ),
    primaryColor: AppColors.primaryColor,
    iconTheme: const IconThemeData(color: AppColors.primaryColor),
    scaffoldBackgroundColor: AppColors.scaffoldBackgroundColor,
    dividerColor: AppColors.dividerColor,
    textTheme: GoogleFonts.cairoTextTheme(ThemeData.light().textTheme),
    colorScheme: const ColorScheme.light(
      primary: AppColors.primaryColor,
      secondary: AppColors.secondaryColor,
      onSecondary: AppColors.textOnPrimaryColor,
      secondaryContainer: AppColors.infoSurfaceColor,
      onSecondaryContainer: AppColors.primaryColor,
      surface: AppColors.surfaceColor,
      error: AppColors.dangerColor,
      onPrimary: AppColors.textOnPrimaryColor,
      onSurface: AppColors.textPrimaryColor,
      onSurfaceVariant: AppColors.textSecondaryColor,
      outline: AppColors.borderColor,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.surfaceColor,
      foregroundColor: AppColors.textPrimaryColor,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: GoogleFonts.cairo(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimaryColor,
      ),
      systemOverlayStyle: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        systemNavigationBarColor: Colors.transparent,
        systemNavigationBarIconBrightness: Brightness.dark,
        systemNavigationBarContrastEnforced: false,
      ),
    ),
    cardTheme: const CardThemeData(
      color: AppColors.surfaceColor,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppRadius.md)),
        side: BorderSide(color: AppColors.borderColor),
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.surfaceColor,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size(0, 56),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        backgroundColor: AppColors.primaryColor,
        foregroundColor: AppColors.textOnPrimaryColor,
        elevation: 0,
        shape: _actionShape,
        textStyle: GoogleFonts.cairo(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 56),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: _actionShape,
        textStyle: GoogleFonts.cairo(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 56),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        foregroundColor: AppColors.primaryColor,
        side: const BorderSide(color: AppColors.borderColor),
        shape: _actionShape,
        textStyle: GoogleFonts.cairo(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surfaceColor,
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: _fieldBorder,
      enabledBorder: _fieldBorder,
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(AppRadius.md)),
        borderSide: BorderSide(color: AppColors.primaryColor, width: 2),
      ),
    ),
    dialogTheme: const DialogThemeData(
      backgroundColor: AppColors.surfaceColor,
      surfaceTintColor: Colors.transparent,
      shape: _actionShape,
    ),
    listTileTheme: const ListTileThemeData(
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      iconColor: AppColors.primaryColor,
      shape: _actionShape,
    ),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: AppColors.surfaceColor,
      surfaceTintColor: Colors.transparent,
      indicatorColor: AppColors.infoSurfaceColor,
      elevation: 0,
      height: 72,
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
