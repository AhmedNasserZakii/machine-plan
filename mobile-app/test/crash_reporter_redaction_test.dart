import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/services/observability/crash_reporter.dart';

void main() {
  test('CrashReporter.redact removes tokens passwords and national ids', () {
    final raw =
        'Authorization: Bearer abc.def.ghi password=secret nationalId=29901011234567 '
        'data:image/png;base64,iVBORw0KGgo=';
    final cleaned = CrashReporter.redact(raw);
    expect(cleaned.toLowerCase(), isNot(contains('abc.def.ghi')));
    expect(cleaned.toLowerCase(), isNot(contains('secret')));
    expect(cleaned.toLowerCase(), isNot(contains('29901011234567')));
    expect(cleaned.toLowerCase(), isNot(contains('iVBORw0KGgo')));
    expect(cleaned, contains('[redacted]'));
  });
}
