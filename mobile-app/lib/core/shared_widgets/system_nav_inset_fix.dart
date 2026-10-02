import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';

/// Keeps Flutter content clear of the Android OS navigation button bar
/// (and the iOS home indicator) under edge-to-edge display.
///
/// On Android 15+, the system draws the app behind the 3-button / gesture bar
/// and sometimes reports [MediaQueryData.padding.bottom] as `0` even though
/// [MediaQueryData.viewPadding.bottom] still has the real inset. Without a
/// fix, FABs, list tails and bottom action bars sit under those buttons.
///
/// This widget:
/// 1. Restores bottom padding from viewPadding when Android under-reports it
/// 2. Applies a bottom [SafeArea] with a surface fill behind the system bar
class SystemNavInsetFix extends StatelessWidget {
  const SystemNavInsetFix({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final MediaQueryData raw = MediaQuery.of(context);
    MediaQueryData data = raw;

    if (defaultTargetPlatform == TargetPlatform.android) {
      final double correctedBottom = math.max(
        0.0,
        raw.viewPadding.bottom - raw.viewInsets.bottom,
      );
      final double bottom = math.max(raw.padding.bottom, correctedBottom);
      if (bottom != raw.padding.bottom) {
        data = raw.copyWith(padding: raw.padding.copyWith(bottom: bottom));
      }
    }

    return MediaQuery(
      data: data,
      child: ColoredBox(
        color: AppColors.surfaceColor,
        child: SafeArea(top: false, bottom: true, child: child),
      ),
    );
  }
}
