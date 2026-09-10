import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:local_auth/local_auth.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/resources/debug_print.dart';

/// Confirms a hand-off with the device's own biometric hardware —
/// evidence that this device verified this user's fingerprint or face at
/// this moment, not a second authentication factor.
///
/// Deliberately separate from `BiometricService` (login unlock, a
/// stored-credential convenience keyed to `LocalStorage`'s
/// biometric-login flag): the two answer different questions, and folding
/// them together would mean whatever unlocks the app also signs for
/// deliveries in its name (`14-feature-signature-biometric.md`).
class HandoverBiometricService {
  HandoverBiometricService({
    LocalAuthentication? localAuth,
    DeviceInfoPlugin? deviceInfo,
  }) : _localAuth = localAuth ?? LocalAuthentication(),
       _deviceInfo = deviceInfo ?? DeviceInfoPlugin();

  final LocalAuthentication _localAuth;
  final DeviceInfoPlugin _deviceInfo;

  Future<bool> isAvailable() async {
    try {
      if (!await _localAuth.isDeviceSupported()) return false;
      return await _localAuth.canCheckBiometrics;
    } catch (error, stackTrace) {
      printDebug(
        message: 'handover biometric isAvailable failed: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return false;
    }
  }

  /// `biometricOnly: true` is not negotiable: a device PIN is not this
  /// person's fingerprint, and falling back to it would mean anyone who
  /// knows the PIN can sign for a delivery in someone else's name.
  Future<bool> authenticate({required String reason}) async {
    try {
      return await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );
    } catch (error, stackTrace) {
      printDebug(
        message: 'handover biometric authenticate failed: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return false;
    }
  }

  /// The same per-install id already sent as `X-Device-Id` on every request —
  /// this is "this device", not a second identity invented for signatures.
  String deviceId() => LocalStorage.getDeviceId();

  Future<String?> deviceModel() async {
    try {
      if (Platform.isAndroid) {
        final AndroidDeviceInfo info = await _deviceInfo.androidInfo;
        return '${info.manufacturer} ${info.model}'.trim();
      }
      if (Platform.isIOS) {
        final IosDeviceInfo info = await _deviceInfo.iosInfo;
        return info.modelName;
      }
    } catch (error, stackTrace) {
      printDebug(
        message: 'handover biometric deviceModel failed: ${error.toString()}',
        stackTrace: stackTrace,
      );
    }
    return null;
  }
}
