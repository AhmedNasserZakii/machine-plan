import 'package:flutter/material.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';

/// `Icons.arrow_back` is direction-aware under `Directionality`, so this flips
/// automatically between Arabic and English.
class ArrowBackWidget extends StatelessWidget {
  const ArrowBackWidget({super.key, this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ClickedWidget(
      onTap: onTap ?? () => Navigator.maybePop(context),
      child: Padding(
        padding: const EdgeInsets.only(
          left: 12,
          right: 12,
          top: 12,
          bottom: 12,
        ),
        child: Container(
          width: 36,
          height: 36,
          alignment: AlignmentDirectional.center,
          decoration: BoxDecoration(
            color: AppColors.surfaceColor,
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: AppColors.borderColor),
          ),
          child: const Icon(
            Icons.arrow_back,
            size: 20,
            color: AppColors.textPrimaryColor,
          ),
        ),
      ),
    );
  }
}
