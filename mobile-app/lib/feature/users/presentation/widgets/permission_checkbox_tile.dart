import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/users/domain/entities/user_permissions_entity.dart';

/// One permission row, in one of three states.
///
/// Tapping walks `inherited → allowed → denied → inherited`. The state is
/// always spelled out in words next to the icon: "from role" and "denied" look
/// alike at a glance otherwise, and getting this wrong hands someone the
/// company's finances.
class PermissionCheckboxTile extends StatelessWidget {
  const PermissionCheckboxTile({
    required this.code,
    required this.displayName,
    required this.assignment,
    required this.grantedByRole,
    required this.onTap,
    super.key,
    this.enabled = true,
  });

  final String code;
  final String displayName;
  final PermissionAssignment assignment;

  /// Needed to render the inherited state honestly: an inherited permission
  /// the role does not grant is unchecked, not checked-and-grey.
  final bool grantedByRole;
  final VoidCallback onTap;
  final bool enabled;

  bool get _isGranted => switch (assignment) {
        PermissionAssignment.allowed => true,
        PermissionAssignment.denied => false,
        PermissionAssignment.inherited => grantedByRole,
      };

  Color get _accent => switch (assignment) {
        PermissionAssignment.allowed => AppColors.successColor,
        PermissionAssignment.denied => AppColors.dangerColor,
        PermissionAssignment.inherited => AppColors.textSecondaryColor,
      };

  IconData get _icon => switch (assignment) {
        PermissionAssignment.allowed => Icons.check_circle_rounded,
        PermissionAssignment.denied => Icons.cancel_rounded,
        PermissionAssignment.inherited => grantedByRole
            ? Icons.check_circle_outline_rounded
            : Icons.circle_outlined,
      };

  String get _label => switch (assignment) {
        PermissionAssignment.allowed => LocaleKeys.userPermissionsAllowed,
        PermissionAssignment.denied => LocaleKeys.userPermissionsDenied,
        PermissionAssignment.inherited => LocaleKeys.userPermissionsFromRole,
      };

  @override
  Widget build(BuildContext context) {
    return Semantics(
      identifier: 'permission_tile_$code',
      child: ClickedWidget(
        onTap: enabled ? onTap : null,
        child: Padding(
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            children: <Widget>[
              Icon(_icon, size: 22, color: _accent),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      displayName,
                      style: Styles.s14(context).copyWith(
                        color: _isGranted
                            ? AppColors.textPrimaryColor
                            : AppColors.textSecondaryColor,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _label.tr(),
                      style: Styles.s12(context).copyWith(color: _accent),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
