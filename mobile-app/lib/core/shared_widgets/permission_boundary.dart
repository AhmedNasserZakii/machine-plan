import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';

/// A route-level access check. Buttons are still hidden for good UX, but a
/// stale deep link or an already-open route cannot bypass the screen boundary.
class PermissionBoundary extends StatelessWidget {
  const PermissionBoundary({
    required this.permission,
    required this.child,
    super.key,
  });

  final String permission;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final service = getIt<PermissionService>();
    return ValueListenableBuilder<List<String>>(
      valueListenable: service.permissions,
      builder: (context, _, _) {
        if (service.has(permission)) return child;
        return Scaffold(
          appBar: AppBar(),
          body: Center(
            child: Padding(
              padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  const Icon(Icons.lock_outline, size: 56),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    LocaleKeys.noPermissionTitle.tr(),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    LocaleKeys.noPermissionSubtitle.tr(),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
