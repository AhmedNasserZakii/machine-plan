import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';

/// Role picker. Shows the permission count under each name so the Director is
/// choosing on what the role can do, not only on what it is called.
class RoleSelector extends StatelessWidget {
  const RoleSelector({
    required this.roles,
    required this.selected,
    required this.onChanged,
    super.key,
    this.errorText,
  });

  final List<RoleEntity> roles;
  final RoleEntity? selected;
  final ValueChanged<RoleEntity> onChanged;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          LocaleKeys.userRole.tr(),
          style: Styles.s14(context).copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.sm),
        Semantics(
          identifier: 'user_role_selector',
          child: InputDecorator(
            decoration: InputDecoration(
              errorText: errorText,
              contentPadding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.xs,
              ),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<RoleEntity>(
                value: selected,
                isExpanded: true,
                hint: Text(
                  LocaleKeys.userPickRole.tr(),
                  style: Styles.s14(
                    context,
                  ).copyWith(color: AppColors.textPlaceholderColor),
                ),
                items: roles
                    .map(
                      (RoleEntity role) => DropdownMenuItem<RoleEntity>(
                        value: role,
                        child: Text(
                          role.displayName,
                          style: Styles.s14(context),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(growable: false),
                onChanged: (RoleEntity? role) {
                  if (role != null) {
                    onChanged(role);
                  }
                },
              ),
            ),
          ),
        ),
        if (selected?.description != null) ...<Widget>[
          const SizedBox(height: AppSpacing.xs),
          Text(
            selected!.description!,
            style: Styles.s12(
              context,
            ).copyWith(color: AppColors.textSecondaryColor),
          ),
        ],
      ],
    );
  }
}
