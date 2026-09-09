import 'package:machinery/core/constants/api_keys.dart';

/// `POST /auth/login` → `{ success, data: { accessToken, refreshToken,
/// expiresIn, refreshExpiresAt, mustChangePassword } }`.
///
/// Tokens only, by design: the profile and the permission list come from
/// `GET /auth/me`, which the repository calls straight after a successful
/// login (`04-auth-and-permissions.md`).
class AuthSessionResponseModel {
  const AuthSessionResponseModel({
    required this.accessToken,
    required this.refreshToken,
    required this.mustChangePassword,
  });

  final String accessToken;
  final String refreshToken;
  final bool mustChangePassword;

  factory AuthSessionResponseModel.fromDataJson(Map<String, dynamic> json) {
    return AuthSessionResponseModel(
      accessToken: json[ApiKeys.accessToken] as String? ?? '',
      refreshToken: json[ApiKeys.refreshToken] as String? ?? '',
      mustChangePassword: json[ApiKeys.mustChangePassword] as bool? ?? false,
    );
  }
}
