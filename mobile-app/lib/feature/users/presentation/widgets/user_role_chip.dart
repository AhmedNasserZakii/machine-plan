import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';

/// The role name exactly as the server localized it. No client-side mapping:
/// roles can be renamed in the back office and this must follow.
class UserRoleChip extends StatelessWidget {
  const UserRoleChip({required this.roleName, super.key});

  final String roleName;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceAltColor,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        roleName,
        style: Styles.s12(
          context,
        ).copyWith(color: AppColors.textSecondaryColor),
      ),
    );
  }
}
