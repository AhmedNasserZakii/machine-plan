import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

class NotificationsGroupHeader extends StatelessWidget {
  const NotificationsGroupHeader({required this.label, super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(
        top: AppSpacing.md,
        bottom: AppSpacing.sm,
        start: AppSpacing.xs,
      ),
      child: Text(
        label,
        style: Styles.s13(context).copyWith(
          color: AppColors.textSecondaryColor,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
