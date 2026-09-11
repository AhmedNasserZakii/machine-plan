import 'dart:io' show Platform;

/// Compile-time flavor and store targets.
///
/// Pass with `--dart-define=APP_ENV=staging` or
/// `--dart-define-from-file=config/staging.env.json`.
abstract class AppEnvironment {
  AppEnvironment._();

  static const String raw = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'development',
  );

  static const String clientVersion = String.fromEnvironment(
    'APP_VERSION',
    defaultValue: '1.0.0',
  );

  static const String androidStoreUrl = String.fromEnvironment(
    'ANDROID_STORE_URL',
  );

  static const String iosStoreUrl = String.fromEnvironment('IOS_STORE_URL');

  static AppFlavor get flavor => switch (raw) {
        'staging' => AppFlavor.staging,
        'production' => AppFlavor.production,
        _ => AppFlavor.development,
      };

  static bool get isDevelopment => flavor == AppFlavor.development;
  static bool get isProduction => flavor == AppFlavor.production;

  static String? get storeUrl {
    if (Platform.isAndroid && androidStoreUrl.isNotEmpty) {
      return androidStoreUrl;
    }
    if (Platform.isIOS && iosStoreUrl.isNotEmpty) {
      return iosStoreUrl;
    }
    if (androidStoreUrl.isNotEmpty) return androidStoreUrl;
    if (iosStoreUrl.isNotEmpty) return iosStoreUrl;
    return null;
  }
}

enum AppFlavor { development, staging, production }
