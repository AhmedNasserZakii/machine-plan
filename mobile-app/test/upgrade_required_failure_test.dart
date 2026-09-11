import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';

void main() {
  test('HTTP 426 maps to UpgradeRequiredFailure with minVersion', () {
    final failure = ServerFailure.fromResponse(426, <String, dynamic>{
      'error': <String, dynamic>{
        'code': 'CLIENT_UPGRADE_REQUIRED',
        'message': 'Please upgrade',
        'extra': <String, dynamic>{'minVersion': '2.0.0'},
      },
    });

    expect(failure, isA<UpgradeRequiredFailure>());
    expect((failure as UpgradeRequiredFailure).minVersion, '2.0.0');
    expect(failure.code, 'CLIENT_UPGRADE_REQUIRED');
  });

  test('CLIENT_UPGRADE_REQUIRED code is recognized even without 426', () {
    final failure = ServerFailure.fromResponse(400, <String, dynamic>{
      'error': <String, dynamic>{
        'code': 'CLIENT_UPGRADE_REQUIRED',
        'message': 'Please upgrade',
        'params': <String, dynamic>{'minVersion': '1.2.0'},
      },
    });

    expect(failure, isA<UpgradeRequiredFailure>());
    expect((failure as UpgradeRequiredFailure).minVersion, '1.2.0');
  });
}
