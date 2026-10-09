import 'package:equatable/equatable.dart';

class AuthUserEntity extends Equatable {
  const AuthUserEntity({
    required this.id,
    required this.name,
    required this.phone,
    required this.roleCode,
    required this.roleName,
    required this.mustChangePassword,
    this.branchId,
    this.branchName,
  });

  final String id;
  final String name;
  final String phone;

  /// Stable wire code (`DIRECTOR`, …). Used to localize system roles.
  final String roleCode;

  /// Server display name. Prefer [roleCode] + `RoleLabels` for system roles.
  /// Nothing in the UI branches on the role — gating reads the permission list.
  final String roleName;

  final bool mustChangePassword;
  final String? branchId;
  final String? branchName;

  AuthUserEntity copyWith({bool? mustChangePassword}) {
    return AuthUserEntity(
      id: id,
      name: name,
      phone: phone,
      roleCode: roleCode,
      roleName: roleName,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      branchId: branchId,
      branchName: branchName,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    id,
    name,
    phone,
    roleCode,
    roleName,
    mustChangePassword,
    branchId,
    branchName,
  ];
}
