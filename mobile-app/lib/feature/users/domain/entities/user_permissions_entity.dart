import 'package:equatable/equatable.dart';

/// A per-user override. The backend stores these beside the role rather than
/// copying the role's grants onto the user, so a role change still flows
/// through to everyone who holds it.
enum PermissionEffect { allow, deny }

/// How one permission ends up granted or withheld for one user.
enum PermissionAssignment {
  /// Whatever the role says. No override row exists.
  inherited,

  /// Granted to this user specifically, on top of the role.
  allowed,

  /// Withheld from this user specifically, despite the role.
  denied,
}

/// `GET /users/:id/permissions`.
class UserPermissionsEntity extends Equatable {
  const UserPermissionsEntity({
    required this.userId,
    required this.rolePermissions,
    required this.overrides,
    required this.effectivePermissions,
  });

  final String userId;

  /// What the role grants, before overrides.
  final Set<String> rolePermissions;

  /// Permission code → effect. Only codes that actually have an override.
  final Map<String, PermissionEffect> overrides;

  /// What the server resolved. Kept so the UI can be checked against the
  /// server's own answer rather than trusting the client's arithmetic.
  final Set<String> effectivePermissions;

  PermissionAssignment assignmentOf(String code) {
    return switch (overrides[code]) {
      PermissionEffect.allow => PermissionAssignment.allowed,
      PermissionEffect.deny => PermissionAssignment.denied,
      null => PermissionAssignment.inherited,
    };
  }

  @override
  List<Object?> get props => <Object?>[
        userId,
        rolePermissions,
        overrides,
        effectivePermissions,
      ];
}
