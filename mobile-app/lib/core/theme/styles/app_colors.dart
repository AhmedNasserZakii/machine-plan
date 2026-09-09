import 'package:flutter/material.dart';

/// Semantic colour tokens. Feature code must never declare a raw `Color(0x…)`.
abstract class AppColors {
  // ── Brand ────────────────────────────────────────────────────────────────
  static const Color primaryColor = Color(0xff1B4965);
  static const Color primaryLightColor = Color(0xff3E7CA6);
  static const Color secondaryColor = Color(0xff5FA8D3);

  // ── Surfaces ─────────────────────────────────────────────────────────────
  static const Color scaffoldBackgroundColor = Color(0xffF7F9FB);
  static const Color surfaceColor = Color(0xffFFFFFF);
  static const Color surfaceAltColor = Color(0xffEDF2F7);
  static const Color whiteColor = Color(0xffFFFFFF);
  static const Color blackColor = Color(0xff000000);

  // ── Borders & dividers ───────────────────────────────────────────────────
  static const Color borderColor = Color(0xffDDE3EA);
  static const Color dividerColor = Color(0xffE8E9F1);

  // ── Text ─────────────────────────────────────────────────────────────────
  static const Color textPrimaryColor = Color(0xff1A202C);
  static const Color textSecondaryColor = Color(0xff4A5568);
  static const Color textDisabledColor = Color(0xffA0AEC0);
  static const Color textPlaceholderColor = Color(0xffA0AEC0);
  static const Color textOnPrimaryColor = Color(0xffFFFFFF);

  // ── Semantic ─────────────────────────────────────────────────────────────
  static const Color successColor = Color(0xff2F855A);
  static const Color warningColor = Color(0xffD69E2E);
  static const Color dangerColor = Color(0xffC53030);
  static const Color infoColor = Color(0xff2B6CB0);
  static const Color neutralColor = Color(0xff718096);

  // ── Semantic surfaces (chips, banners, badges) ───────────────────────────
  static const Color successSurfaceColor = Color(0xffE6F4EC);
  static const Color warningSurfaceColor = Color(0xffFDF3E1);
  static const Color dangerSurfaceColor = Color(0xffFCE8E8);
  static const Color infoSurfaceColor = Color(0xffE7F0FA);
  static const Color neutralSurfaceColor = Color(0xffEDF2F7);

  // ── States ───────────────────────────────────────────────────────────────
  static const Color disabledButtonColor = Color(0xffE2E8F0);
  static const Color offlineBannerColor = Color(0xff4A5568);
  static const Color badgeColor = Color(0xffC53030);
  static const Color shimmerBaseColor = Color(0xffEDF2F7);

  /// Backs text drawn over the camera preview. Opaque enough to stay legible
  /// against a white sticker under warehouse lighting.
  static const Color scrimColor = Color(0xcc000000);
}
