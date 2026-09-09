import 'package:flutter/material.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/auth/domain/entities/auth_user_entity.dart';

/// Who am I and which branch am I acting for — the two things a field user
/// checks before a hand-over goes wrong.
class MoreProfileHeader extends StatelessWidget {
  const MoreProfileHeader({required this.user, super.key});

  final AuthUserEntity user;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surfaceColor,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Row(
        children: <Widget>[
          CircleAvatar(
            radius: 28,
            backgroundColor: AppColors.infoSurfaceColor,
            child: Text(
              _initials(user.name),
              style: Styles.s17(
                context,
              ).copyWith(color: AppColors.primaryColor),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  user.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Styles.s16(context),
                ),
                const SizedBox(height: 2),
                Text(
                  user.roleName,
                  style: Styles.s13(
                    context,
                  ).copyWith(color: AppColors.textSecondaryColor),
                ),
                if ((user.branchName ?? '').isNotEmpty) ...<Widget>[
                  const SizedBox(height: 2),
                  Row(
                    children: <Widget>[
                      const Icon(
                        Icons.location_on_outlined,
                        size: 14,
                        color: AppColors.textSecondaryColor,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          user.branchName!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Styles.s13(
                            context,
                          ).copyWith(color: AppColors.textSecondaryColor),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _initials(String name) {
    final List<String> parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList(growable: false);

    if (parts.isEmpty) {
      return '؟';
    }
    if (parts.length == 1) {
      return parts.first.characters.first;
    }
    return '${parts.first.characters.first}${parts[1].characters.first}';
  }
}
