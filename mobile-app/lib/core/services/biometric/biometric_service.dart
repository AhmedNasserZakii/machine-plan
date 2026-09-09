import 'package:easy_localization/easy_localization.dart';
import 'package:local_auth/local_auth.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/resources/debug_print.dart';

/// Unlocks a credential already stored on this device.
///
/// This is convenience, not authorization — the security boundary is still the
/// refresh token behind the platform keystore. It is a different thing from
/// biometric hand-off confirmation, which is evidence rather than
/// authentication.
class BiometricService {
  BiometricService({LocalAuthentication? localAuth})
    : _localAuth = localAuth ?? LocalAuthentication();

  final LocalAuthentication _localAuth;

  Future<bool> isAvailable() async {
    try {
      final bool isSupported = await _localAuth.isDeviceSupported();
      if (!isSupported) {
        return false;
      }
      return await _localAuth.canCheckBiometrics;
    } catch (error, stackTrace) {
      printDebug(
        message: 'biometric isAvailable failed: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return false;
    }
  }

  /// True when the user has opted in and this device still holds a refresh
  /// token to unlock.
  Future<bool> isLoginEnabled() async {
    if (!LocalStorage.getIsBiometricLoginEnabled()) {
      return false;
    }
    if ((await LocalStorage.getRefreshToken()).isEmpty) {
      return false;
    }
    return isAvailable();
  }

  Future<bool> authenticate({String? reason}) async {
    try {
      return await _localAuth.authenticate(
        localizedReason: reason ?? LocaleKeys.loginWithBiometric.tr(),
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );
    } catch (error, stackTrace) {
      printDebug(
        message: 'biometric authenticate failed: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return false;
    }
  }

  Future<void> setLoginEnabled({required bool isEnabled}) {
    return LocalStorage.setIsBiometricLoginEnabled(value: isEnabled);
  }
}
