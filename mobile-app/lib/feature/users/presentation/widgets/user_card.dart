import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/presentation/widgets/user_avatar.dart';
import 'package:machinery/feature/users/presentation/widgets/user_role_chip.dart';
import 'package:machinery/feature/users/presentation/widgets/user_status_chip.dart';

/// One row in the users list.
class UserCard extends StatelessWidget {
  const UserCard({required this.user, required this.onTap, super.key});

  final UserEntity user;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      identifier: 'user_card_${user.phone}',
      child: ClickedWidget(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.surfaceColor,
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: AppColors.borderColor),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              UserAvatar(fullName: user.fullName),
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
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.xs),

                    // A phone number is digits: it reads left-to-right even in
                    // an Arabic layout.
                    LtrText(
                      user.phone,
                      style: Styles.s13(
                        context,
                      ).copyWith(color: AppColors.textSecondaryColor),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: <Widget>[
                        UserRoleChip(roleName: user.roleName),
                        if (user.branchName != null)
                          UserRoleChip(roleName: user.branchName!),
                        if (!user.isActive)
                          const UserStatusChip(isActive: false),
                      ],
                    ),
                    if (!user.hasSignedInBefore) ...<Widget>[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        LocaleKeys.userNeverSignedIn.tr(),
                        style: Styles.s12(
                          context,
                        ).copyWith(color: AppColors.textDisabledColor),
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppColors.textSecondaryColor,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
