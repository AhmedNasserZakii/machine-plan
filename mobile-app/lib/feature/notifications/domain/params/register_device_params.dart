import 'package:equatable/equatable.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/utils/enums.dart';

/// Body for `POST /devices`.
class RegisterDeviceParams extends Equatable {
  const RegisterDeviceParams({
    required this.deviceId,
    this.pushToken,
    this.deviceModel,
    this.platform,
  });

  final String deviceId;
  final String? pushToken;
  final String? deviceModel;
  final DevicePlatform? platform;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      ApiKeys.deviceId: deviceId,
      if (pushToken != null && pushToken!.isNotEmpty)
        ApiKeys.pushToken: pushToken,
      if (deviceModel != null && deviceModel!.isNotEmpty)
        ApiKeys.deviceModel: deviceModel,
      if (platform != null && platform != DevicePlatform.unknown)
        ApiKeys.platform: platform!.value,
    };
  }

  @override
  List<Object?> get props => <Object?>[deviceId, pushToken, deviceModel, platform];
}
