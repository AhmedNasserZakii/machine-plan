import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/presentation/widgets/user_avatar.dart';

/// Who is being edited, pinned above the list. Without this it is far too easy
/// to grant the finance module to the wrong person.
class UserPermissionsHeader extends StatelessWidget {
  const UserPermissionsHeader({required this.user, super.key});

  final UserEntity user;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      color: AppColors.surfaceColor,
      child: Row(
        children: <Widget>[
          UserAvatar(fullName: user.fullName, size: 40),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  user.fullName,
                  style: Styles.s15(
                    context,
                  ).copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  <String?>[
                    user.roleName,
                    user.branchName,
                  ].whereType<String>().join(' — '),
                  style: Styles.s13(
                    context,
                  ).copyWith(color: AppColors.textSecondaryColor),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
