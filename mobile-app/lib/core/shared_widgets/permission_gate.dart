import 'package:flutter/material.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_service.dart';

/// Renders [child] only when the permission is held.
///
/// Prefer hiding over disabling. A greyed-out "record expense" button tells a
/// representative that a feature exists and he is not trusted with it, which
/// invites questions his supervisor has to field.
///
/// Listens to the permission list, so a grant made by the Director while the
/// app is open takes effect without a restart.
class PermissionGate extends StatelessWidget {
  const PermissionGate({
    required this.child,
    super.key,
    this.permission,
    this.anyOf,
    this.fallback,
  }) : assert(
         permission != null || anyOf != null,
         'PermissionGate needs either permission or anyOf',
       );

  final String? permission;
  final List<String>? anyOf;
  final Widget child;
  final Widget? fallback;

  @override
  Widget build(BuildContext context) {
    final PermissionService service = getIt<PermissionService>();

    return ValueListenableBuilder<List<String>>(
      valueListenable: service.permissions,
      builder: (context, _, _) {
        final bool isAllowed = permission != null
            ? service.has(permission!)
            : service.hasAny(anyOf ?? const <String>[]);

        return isAllowed ? child : fallback ?? const SizedBox.shrink();
      },
    );
  }
}
