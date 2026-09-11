import 'dart:async';

/// Blocks the app when the backend rejects the client as too old (HTTP 426).
///
/// Same bootstrap pattern as [UnauthorizedSessionHandler]: `my_app.dart`
/// registers the UI callback so `core/` never imports a feature screen.
abstract class UpgradeRequiredHandler {
  UpgradeRequiredHandler._();

  static Future<void> Function({required String message, String? minVersion})?
  _onUpgradeRequired;
  static bool _isHandling = false;

  static bool get isBlocking => _isHandling;

  static void register(
    Future<void> Function({required String message, String? minVersion})
    onUpgradeRequired,
  ) {
    _onUpgradeRequired = onUpgradeRequired;
  }

  static Future<void> handle({
    required String message,
    String? minVersion,
  }) async {
    if (_isHandling) return;
    final callback = _onUpgradeRequired;
    if (callback == null) return;

    _isHandling = true;
    // The upgrade screen never pops, so awaiting it would hang Dio. Launch
    // the blocker and let the failed request continue to its caller.
    unawaited(callback(message: message, minVersion: minVersion));
  }
}
