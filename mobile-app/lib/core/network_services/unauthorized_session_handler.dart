import 'dart:async';

/// Central reaction to a session that can no longer be refreshed.
///
/// Deviation from the reference app, on purpose: the handler holds a callback
/// registered at bootstrap instead of importing the login screen directly, so
/// `core/` never depends on a feature. `my_app.dart` supplies the callback.
abstract class UnauthorizedSessionHandler {
  UnauthorizedSessionHandler._();

  static Future<void> Function(String message)? _onSessionExpired;
  static bool _isHandling = false;

  /// True while the expiry dialog is on screen, so listeners suppress their
  /// own error toast and the user sees one message, not two.
  static bool get shouldSuppressErrorToast => _isHandling;

  static void register(Future<void> Function(String message) onSessionExpired) {
    _onSessionExpired = onSessionExpired;
  }

  static Future<void> handle({required String message}) async {
    if (_isHandling) {
      return;
    }

    final Future<void> Function(String message)? callback = _onSessionExpired;
    if (callback == null) {
      return;
    }

    _isHandling = true;
    try {
      await callback(message);
    } finally {
      _isHandling = false;
    }
  }
}
