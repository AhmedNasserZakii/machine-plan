import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/core/services/observability/crash_reporter.dart';

/// Product analytics for key funnels — never attach PII, money amounts,
/// signature bytes, or national IDs to [properties].
abstract class AppAnalytics {
  Future<void> track(String event, {Map<String, Object?>? properties});
}

/// Debug/local sink used until a real provider (Firebase/Amplitude/…) is wired.
class LoggingAnalytics implements AppAnalytics {
  @override
  Future<void> track(String event, {Map<String, Object?>? properties}) async {
    final safe = properties == null
        ? null
        : Map<String, Object?>.fromEntries(
            properties.entries.map(
              (e) => MapEntry(e.key, CrashReporter.redact('${e.value}')),
            ),
          );
    printDebug(message: 'analytics $event ${safe ?? ''}');
  }
}

/// Canonical funnel event names so call sites stay consistent.
abstract class AnalyticsEvents {
  static const String loginSuccess = 'login_success';
  static const String loginFailure = 'login_failure';
  static const String transferCreated = 'transfer_created';
  static const String transferConfirmed = 'transfer_confirmed';
  static const String syncFlushFailed = 'sync_flush_failed';
  static const String syncFlushSucceeded = 'sync_flush_succeeded';
  static const String upgradeRequiredShown = 'upgrade_required_shown';
}
