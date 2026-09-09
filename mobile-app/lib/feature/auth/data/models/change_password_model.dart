import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/feature/auth/domain/params/change_password_params.dart';

class ChangePasswordModel {
  const ChangePasswordModel({
    required this.currentPassword,
    required this.newPassword,
  });

  final String currentPassword;
  final String newPassword;

  factory ChangePasswordModel.fromParams(ChangePasswordParams params) {
    return ChangePasswordModel(
      currentPassword: params.currentPassword,
      newPassword: params.newPassword,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      ApiKeys.currentPassword: currentPassword,
      ApiKeys.newPassword: newPassword,
    };
  }
}
