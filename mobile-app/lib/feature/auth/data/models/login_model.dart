import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/feature/auth/domain/params/login_params.dart';

/// Body for `POST /auth/login`. The endpoint rejects unknown fields, so the
/// push token is not sent here — it is registered separately through
/// `POST /auth/devices`.
class LoginModel {
  const LoginModel({
    required this.phone,
    required this.password,
    required this.deviceId,
  });

  final String phone;
  final String password;
  final String deviceId;

  factory LoginModel.fromParams(LoginParams params) {
    return LoginModel(
      phone: params.phone,
      password: params.password,
      deviceId: params.deviceId,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      ApiKeys.phone: phone,
      ApiKeys.password: password,
      ApiKeys.deviceId: deviceId,
    };
  }
}
