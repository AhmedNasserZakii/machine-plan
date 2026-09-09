import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/users/domain/entities/permission_catalogue_entity.dart';
import 'package:machinery/feature/users/domain/entities/permission_draft.dart';
import 'package:machinery/feature/users/presentation/widgets/permission_checkbox_tile.dart';

/// A collapsible module of permissions. Collapsed by default with a badge for
/// how many rows inside are overridden, so the Director can see which modules
/// have been customised without opening all of them.
class PermissionGroupTile extends StatelessWidget {
  const PermissionGroupTile({
    required this.group,
    required this.draft,
    required this.isExpanded,
    required this.onToggleGroup,
    required this.onTogglePermission,
    super.key,
    this.enabled = true,
  });

  final PermissionGroupEntity group;
  final PermissionDraft draft;
  final bool isExpanded;
  final VoidCallback onToggleGroup;
  final ValueChanged<String> onTogglePermission;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final int overrides = draft.overrideCountIn(
      group.permissions.map((PermissionEntity p) => p.code),
    );

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceColor,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Column(
        children: <Widget>[
          Semantics(
            identifier: 'permission_group_${group.group}',
            child: ClickedWidget(
              onTap: onToggleGroup,
              child: Padding(
                padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                child: Row(
                  children: <Widget>[
                    Icon(
                      isExpanded
                          ? Icons.expand_less_rounded
                          : Icons.expand_more_rounded,
                      size: 22,
                      color: AppColors.textSecondaryColor,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        group.label,
                        style: Styles.s15(
                          context,
                        ).copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                    if (overrides > 0)
                      Container(
                        padding: const EdgeInsetsDirectional.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: AppSpacing.xs,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.infoSurfaceColor,
                          borderRadius: BorderRadius.circular(AppRadius.pill),
                        ),
                        child: Text(
                          LocaleKeys.userPermissionsOverrideCount.tr(
                            args: <String>['$overrides'],
                          ),
                          style: Styles.s12(
                            context,
                          ).copyWith(color: AppColors.infoColor),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          if (isExpanded) ...<Widget>[
            const Divider(height: 1, color: AppColors.dividerColor),
            ...group.permissions.map(
              (PermissionEntity permission) => PermissionCheckboxTile(
                code: permission.code,
                displayName: permission.displayName,
                assignment: draft.assignmentOf(permission.code),
                grantedByRole: draft.grantedByRole(permission.code),
                enabled: enabled,
                onTap: () => onTogglePermission(permission.code),
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
          ],
        ],
      ),
    );
  }
}
