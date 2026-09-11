import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/users/domain/entities/permission_catalogue_entity.dart';
import 'package:machinery/feature/users/domain/entities/permission_draft.dart';
import 'package:machinery/feature/users/domain/entities/user_permissions_entity.dart';

/// Spells out every change before it is sent.
///
/// Permission changes are consequential and easy to make by accident on a
/// phone — the whole screen is a list of tappable rows — so saving is never
/// silent and never automatic.
class PermissionChangesDialog extends StatelessWidget {
  const PermissionChangesDialog({
    required this.changes,
    required this.labels,
    super.key,
  });

  final List<PermissionChange> changes;

  /// Permission code → localized display name, so the dialog reads in words
  /// rather than in codes.
  final Map<String, String> labels;

  static Future<bool> show({
    required BuildContext context,
    required List<PermissionChange> changes,
    required List<PermissionGroupEntity> groups,
  }) async {
    final Map<String, String> labels = <String, String>{
      for (final PermissionGroupEntity group in groups)
        for (final PermissionEntity permission in group.permissions)
          permission.code: permission.displayName,
    };

    final bool? result = await showDialog<bool>(
      context: context,
      builder: (_) => PermissionChangesDialog(changes: changes, labels: labels),
    );

    return result ?? false;
  }

  static ({IconData icon, Color color, String label}) _describe(
    PermissionAssignment assignment,
  ) {
    return switch (assignment) {
      PermissionAssignment.allowed => (
          icon: Icons.check_circle_rounded,
          color: AppColors.successColor,
          label: LocaleKeys.userPermissionsAllowed,
        ),
      PermissionAssignment.denied => (
          icon: Icons.cancel_rounded,
          color: AppColors.dangerColor,
          label: LocaleKeys.userPermissionsDenied,
        ),
      PermissionAssignment.inherited => (
          icon: Icons.remove_circle_outline_rounded,
          color: AppColors.textSecondaryColor,
          label: LocaleKeys.userPermissionsFromRole,
        ),
    };
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppColors.surfaceColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              LocaleKeys.userPermissionsConfirmTitle.tr(),
              textAlign: TextAlign.center,
              style: Styles.s17(context),
            ),
            const SizedBox(height: AppSpacing.md),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: changes.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(height: AppSpacing.sm),
                itemBuilder: (BuildContext context, int index) {
                  final PermissionChange change = changes[index];
                  final ({IconData icon, Color color, String label}) to =
                      _describe(change.to);

                  return Row(
                    children: <Widget>[
                      Icon(to.icon, size: 18, color: to.color),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          labels[change.code] ?? change.code,
                          style: Styles.s14(context),
                        ),
                      ),
                      Text(
                        to.label.tr(),
                        style: Styles.s12(context).copyWith(color: to.color),
                      ),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            CustomButton(
              title: LocaleKeys.save.tr(),
              isLoading: false,
              height: 48,
              identifier: 'permission_changes_confirm',
              onPressed: () => Navigator.of(context).pop(true),
            ),
            const SizedBox(height: AppSpacing.sm),
            CustomButton(
              title: LocaleKeys.cancel.tr(),
              isLoading: false,
              isStroked: true,
              height: 48,
              identifier: 'permission_changes_cancel',
              onPressed: () => Navigator.of(context).pop(false),
            ),
          ],
        ),
      ),
    );
  }
}
