import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/feature/auth/data/models/sub_models/auth_user_model.dart';
import 'package:machinery/feature/auth/domain/entities/auth_profile_entity.dart';

/// `GET /auth/me` → `{ success, data: { id, fullName, phone, role, branch,
/// permissions, mustChangePassword, ... } }`.
///
/// The payload is flat: `permissions` sits beside the profile fields rather
/// than under a `user` wrapper. This is also the shape cached in local
/// storage, so a rep with no signal starts the app with a correctly gated UI.
class AuthProfileResponseModel {
  const AuthProfileResponseModel({
    required this.user,
    required this.permissions,
  });

  final AuthUserModel user;
  final List<String> permissions;

  factory AuthProfileResponseModel.fromDataJson(Map<String, dynamic> json) {
    final dynamic rawPermissions = json[ApiKeys.permissions];

    return AuthProfileResponseModel(
      user: AuthUserModel.fromJson(json),
      permissions: rawPermissions is List
          ? rawPermissions.whereType<String>().toList(growable: false)
          : const <String>[],
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      ...user.toJson(),
      ApiKeys.permissions: permissions,
    };
  }

  AuthProfileEntity toEntity() {
    return AuthProfileEntity(user: user.toEntity(), permissions: permissions);
  }
}
