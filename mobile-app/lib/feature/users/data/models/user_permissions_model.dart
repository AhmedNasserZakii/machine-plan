import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/feature/users/domain/entities/user_permissions_entity.dart';

/// `GET /users/:id/permissions`.
///
/// Overrides arrive as `[{ code, effect }]` with `effect` being `ALLOW` or
/// `DENY`. The server resolves them as
/// `(rolePermissions ∪ ALLOW) \ DENY` — deny always wins — and returns the
/// result in `effectivePermissions`.
class UserPermissionsModel {
  const UserPermissionsModel({
    required this.userId,
    required this.rolePermissions,
    required this.overrides,
    required this.effectivePermissions,
  });

  final String userId;
  final List<String> rolePermissions;
  final Map<String, PermissionEffect> overrides;
  final List<String> effectivePermissions;

  static const String _allow = 'ALLOW';
  static const String _deny = 'DENY';

  factory UserPermissionsModel.fromJson(Map<String, dynamic> json) {
    return UserPermissionsModel(
      userId: json[ApiKeys.userId]?.toString() ?? '',
      rolePermissions: _codes(json[ApiKeys.rolePermissions]),
      overrides: _overrides(json[ApiKeys.overrides]),
      effectivePermissions: _codes(json[ApiKeys.effectivePermissions]),
    );
  }

  UserPermissionsEntity toEntity() {
    return UserPermissionsEntity(
      userId: userId,
      rolePermissions: rolePermissions.toSet(),
      overrides: Map<String, PermissionEffect>.unmodifiable(overrides),
      effectivePermissions: effectivePermissions.toSet(),
    );
  }

  static List<String> _codes(dynamic value) {
    return value is List
        ? value.whereType<String>().toList(growable: false)
        : const <String>[];
  }

  /// An unrecognised effect is dropped rather than guessed at: showing a
  /// permission as inherited is recoverable, showing it as the wrong override
  /// is not.
  static Map<String, PermissionEffect> _overrides(dynamic value) {
    if (value is! List) {
      return const <String, PermissionEffect>{};
    }

    final Map<String, PermissionEffect> result = <String, PermissionEffect>{};

    for (final Map<String, dynamic> entry
        in value.whereType<Map<String, dynamic>>()) {
      final String? code = entry[ApiKeys.code] as String?;
      final String? effect = entry[ApiKeys.effect] as String?;

      if (code == null || code.isEmpty) {
        continue;
      }

      switch (effect) {
        case _allow:
          result[code] = PermissionEffect.allow;
        case _deny:
          result[code] = PermissionEffect.deny;
      }
    }

    return result;
  }
}
