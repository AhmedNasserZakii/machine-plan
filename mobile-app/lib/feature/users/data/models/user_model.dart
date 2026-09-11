import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';

/// `GET /users` and `GET /users/:id`.
///
/// `role` is a nested `{ id, code, displayName }`; `branchId` is flat and may
/// be null. Note this differs from `/auth/me`, which nests `branch` as an
/// object — the two endpoints are not interchangeable.
class UserModel {
  const UserModel({
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
  final String roleName;
  final String? branchId;
  final String? branchName;
  final bool isActive;
  final bool mustChangePassword;
  final bool biometricEnabled;
  final DateTime? lastLoginAt;
  final DateTime? createdAt;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final dynamic rawRole = json[ApiKeys.role];
    final Map<String, dynamic> role =
        rawRole is Map<String, dynamic> ? rawRole : const <String, dynamic>{};

    // Some payloads carry the branch as an object, others as a bare id.
    final dynamic rawBranch = json[ApiKeys.branch];
    final Map<String, dynamic> branch = rawBranch is Map<String, dynamic>
        ? rawBranch
        : const <String, dynamic>{};

    return UserModel(
      id: json[ApiKeys.id]?.toString() ?? '',
      fullName: json[ApiKeys.fullName] as String? ?? '',
      phone: json[ApiKeys.phone] as String? ?? '',
      email: json[ApiKeys.email] as String?,
      roleId: role[ApiKeys.id]?.toString() ?? '',
      roleCode: role[ApiKeys.code] as String? ?? '',
      roleName: role[ApiKeys.displayName] as String? ??
          role[ApiKeys.name] as String? ??
          '',
      branchId:
          json[ApiKeys.branchId]?.toString() ?? branch[ApiKeys.id]?.toString(),
      branchName: json[ApiKeys.branchName] as String? ??
          branch[ApiKeys.name] as String?,
      isActive: json[ApiKeys.isActive] as bool? ?? true,
      mustChangePassword: json[ApiKeys.mustChangePassword] as bool? ?? false,
      biometricEnabled: json[ApiKeys.biometricEnabled] as bool? ?? false,
      lastLoginAt: _dateOrNull(json[ApiKeys.lastLoginAt]),
      createdAt: _dateOrNull(json[ApiKeys.createdAt]),
    );
  }

  UserEntity toEntity() {
    return UserEntity(
      id: id,
      fullName: fullName,
      phone: phone,
      email: email,
      roleId: roleId,
      roleCode: roleCode,
      roleName: roleName,
      branchId: branchId,
      branchName: branchName,
      isActive: isActive,
      mustChangePassword: mustChangePassword,
      biometricEnabled: biometricEnabled,
      lastLoginAt: lastLoginAt,
      createdAt: createdAt,
    );
  }

  /// A malformed timestamp must not take the whole list down with it.
  static DateTime? _dateOrNull(dynamic value) {
    if (value is! String || value.isEmpty) {
      return null;
    }
    return DateTime.tryParse(value)?.toLocal();
  }
}
