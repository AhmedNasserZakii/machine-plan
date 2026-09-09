import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/scanning/data/logic/scanner/scanner_state.dart';

/// The viewfinder frame and the one line of guidance under it.
///
/// The line is what the scanner is doing right now — aiming, resolving, or
/// reporting a miss — because a camera that has silently stopped looking is
/// indistinguishable from one that is still trying.
class ScannerOverlay extends StatelessWidget {
  const ScannerOverlay({required this.state, super.key});

  final ScannerState state;

  static const double _frameSize = 240;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Container(
            width: _frameSize,
            height: _frameSize,
            decoration: BoxDecoration(
              border: Border.all(color: _frameColor, width: 3),
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Container(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: AppColors.scrimColor,
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                if (state is ScannerResolving) ...<Widget>[
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.textOnPrimaryColor,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                ],
                Text(
                  _message,
                  style: Styles.s14(
                    context,
                  ).copyWith(color: AppColors.textOnPrimaryColor),
                ),
              ],
            ),
          ),
          if (state is ScannerNotFound) ...<Widget>[
            const SizedBox(height: AppSpacing.sm),
            Padding(
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.xl,
              ),
              child: Text(
                LocaleKeys.scanNotFoundHint.tr(),
                textAlign: TextAlign.center,
                style: Styles.s12(
                  context,
                ).copyWith(color: AppColors.textOnPrimaryColor),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String get _message {
    return switch (state) {
      ScannerResolving() => LocaleKeys.scanResolving.tr(),
      ScannerNotFound() => LocaleKeys.scanNotFound.tr(),
      _ => LocaleKeys.scanHint.tr(),
    };
  }

  Color get _frameColor {
    return switch (state) {
      ScannerNotFound() => AppColors.dangerColor,
      ScannerResolved() => AppColors.successColor,
      _ => AppColors.textOnPrimaryColor,
    };
  }
}
