import 'package:flutter/foundation.dart';
import 'package:machinery/core/resources/debug_print.dart';

/// Crash / non-fatal error reporting with shared sensitive-data redaction.
///
/// Production builds should register a Sentry/Crashlytics implementation via
/// DI once credentials exist. Until then [LoggingCrashReporter] keeps a local
/// trail without shipping PII.
abstract class CrashReporter {
  Future<void> recordError(
    Object error,
    StackTrace? stack, {
    bool fatal = false,
    Map<String, Object?>? context,
  });

  Future<void> recordFlutterError(FlutterErrorDetails details);

  /// Scrubs tokens, passwords, national IDs, and signature payloads from text
  /// before it is logged or sent upstream.
  static String redact(String input) {
    var out = input;
    for (final pattern in _patterns) {
      out = out.replaceAllMapped(pattern, (_) => '[redacted]');
    }
    return out;
  }

  static final List<RegExp> _patterns = <RegExp>[
    // Must run before the generic `authorization` pattern below: that one's value capture
    // stops at the first space, so on "Authorization: Bearer <token>" it swallows the word
    // "Bearer" as if it were the whole value and leaves the actual token untouched.
    RegExp(r'(bearer\s+)[a-z0-9\-._~+/]+=*', caseSensitive: false),
    RegExp(r'(authorization["\s:=]+)[^,\s}"]+', caseSensitive: false),
    RegExp(r'(password["\s:=]+)[^,\s}"]+', caseSensitive: false),
    RegExp(r'(accessToken["\s:=]+)[^,\s}"]+', caseSensitive: false),
    RegExp(r'(refreshToken["\s:=]+)[^,\s}"]+', caseSensitive: false),
    RegExp(r'(nationalId["\s:=]+)[^,\s}"]+', caseSensitive: false),
    RegExp(r'(national_id["\s:=]+)[^,\s}"]+', caseSensitive: false),
    RegExp(r'data:image\/[a-z]+;base64,[a-z0-9+/=]+', caseSensitive: false),
  ];
}

class LoggingCrashReporter implements CrashReporter {
  @override
  Future<void> recordError(
    Object error,
    StackTrace? stack, {
    bool fatal = false,
    Map<String, Object?>? context,
  }) async {
    printDebug(
      message: 'crashReporter ${fatal ? 'FATAL' : 'error'}: '
          '${CrashReporter.redact(error.toString())}'
          '${context == null ? '' : ' context=${CrashReporter.redact(context.toString())}'}',
      stackTrace: stack,
    );
  }

  @override
  Future<void> recordFlutterError(FlutterErrorDetails details) async {
    await recordError(
      details.exceptionAsString(),
      details.stack,
      fatal: true,
      context: <String, Object?>{
        'library': details.library,
        'context': details.context?.toString(),
      },
    );
  }
}
