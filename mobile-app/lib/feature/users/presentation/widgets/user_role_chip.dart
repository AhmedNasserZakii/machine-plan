import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/users/presentation/helpers/role_labels.dart';

/// System roles are localized from [roleCode]; custom roles keep [roleName]
/// from the server so back-office renames still show through.
class UserRoleChip extends StatelessWidget {
  const UserRoleChip({required this.roleName, this.roleCode, super.key});

  final String roleName;
  final String? roleCode;

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
        RoleLabels.resolve(roleCode, fallback: roleName),
        style: Styles.s12(
          context,
        ).copyWith(color: AppColors.textSecondaryColor),
      ),
    );
  }
}
