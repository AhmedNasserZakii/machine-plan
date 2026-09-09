import 'package:equatable/equatable.dart';

class LoginParams extends Equatable {
  const LoginParams({
    required this.phone,
    required this.password,
    required this.deviceId,
  });

  /// Already normalised to the canonical `01XXXXXXXXX` form.
  final String phone;
  final String password;
  final String deviceId;

  @override
  List<Object?> get props => <Object?>[phone, password, deviceId];
}
