import 'package:equatable/equatable.dart';

/// One account, as returned by `GET /users` and `GET /users/:id`.
///
/// The list and the detail endpoints return the same shape, so there is one
/// entity rather than a list/detail pair that would drift apart.
class UserEntity extends Equatable {
  const UserEntity({
    required this.id,
    required this.fullName,
    required this.phone,
    required this.roleId,
    required this.roleCode,
    required this.roleName,
    required this.isActive,
    required this.mustChangePassword,
    this.email,
    this.branchId,
    this.branchName,
    this.biometricEnabled = false,
    this.lastLoginAt,
    this.createdAt,
  });

  final String id;
  final String fullName;
  final String phone;
  final String? email;

  final String roleId;
  final String roleCode;

  /// Localized by the server.
  final String roleName;

  /// Null for company-level staff, who are not bound to one branch.
  final String? branchId;
  final String? branchName;

  final bool isActive;
  final bool mustChangePassword;
  final bool biometricEnabled;

  /// Null until the account has been used once.
  final DateTime? lastLoginAt;
  final DateTime? createdAt;

  bool get hasSignedInBefore => lastLoginAt != null;

  UserEntity copyWith({String? branchName}) {
    return UserEntity(
      id: id,
      fullName: fullName,
      phone: phone,
      email: email,
      roleId: roleId,
      roleCode: roleCode,
      roleName: roleName,
      branchId: branchId,
      branchName: branchName ?? this.branchName,
      isActive: isActive,
      mustChangePassword: mustChangePassword,
      biometricEnabled: biometricEnabled,
      lastLoginAt: lastLoginAt,
      createdAt: createdAt,
    );
  }

  @override
  List<Object?> get props => <Object?>[
        id,
        fullName,
        phone,
        email,
        roleId,
        roleCode,
        roleName,
        branchId,
        branchName,
        isActive,
        mustChangePassword,
        biometricEnabled,
        lastLoginAt,
        createdAt,
      ];
}
