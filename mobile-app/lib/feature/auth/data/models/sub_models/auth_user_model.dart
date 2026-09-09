import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/feature/auth/domain/entities/auth_user_entity.dart';

/// The profile half of `GET /auth/me`, which is flat: `role` and `branch` are
/// nested objects, and the name arrives as `fullName`.
///
/// `toJson` writes the server's own shape so the cached copy round-trips
/// through this same parser.
class AuthUserModel {
  const AuthUserModel({
    required this.id,
    required this.name,
    required this.phone,
    required this.roleCode,
    required this.roleName,
    required this.mustChangePassword,
    this.email,
    this.branchId,
    this.branchName,
  });

  final String id;
  final String name;
  final String phone;
  final String? email;

  /// Kept so the cached profile round-trips faithfully; the UI gates on
  /// permissions, never on the role.
  final String roleCode;

  /// Localized to the request locale by the server.
  final String roleName;

  final bool mustChangePassword;
  final String? branchId;
  final String? branchName;

  factory AuthUserModel.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> role = _objectAt(json, ApiKeys.role);
    final Map<String, dynamic> branch = _objectAt(json, ApiKeys.branch);

    return AuthUserModel(
      id: json[ApiKeys.id]?.toString() ?? '',
      name: json[ApiKeys.fullName] as String? ?? '',
      phone: json[ApiKeys.phone] as String? ?? '',
      email: json[ApiKeys.email] as String?,
      roleCode: role[ApiKeys.code] as String? ?? '',
      roleName: role[ApiKeys.name] as String? ?? '',
      mustChangePassword: json[ApiKeys.mustChangePassword] as bool? ?? false,
      branchId: branch[ApiKeys.id]?.toString(),
      branchName: branch[ApiKeys.name] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      ApiKeys.id: id,
      ApiKeys.fullName: name,
      ApiKeys.phone: phone,
      ApiKeys.email: email,
      ApiKeys.role: <String, dynamic>{
        ApiKeys.code: roleCode,
        ApiKeys.name: roleName,
      },
      ApiKeys.branch: branchId == null
          ? null
          : <String, dynamic>{ApiKeys.id: branchId, ApiKeys.name: branchName},
      ApiKeys.mustChangePassword: mustChangePassword,
    };
  }

  AuthUserEntity toEntity() {
    return AuthUserEntity(
      id: id,
      name: name,
      phone: phone,
      roleName: roleName,
      mustChangePassword: mustChangePassword,
      branchId: branchId,
      branchName: branchName,
    );
  }

  /// A missing or null nested object reads as empty rather than throwing —
  /// `branch` is null for company-level staff.
  static Map<String, dynamic> _objectAt(Map<String, dynamic> json, String key) {
    final dynamic value = json[key];
    return value is Map<String, dynamic> ? value : const <String, dynamic>{};
  }
}
