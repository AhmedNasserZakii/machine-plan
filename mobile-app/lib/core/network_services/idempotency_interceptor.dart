import 'dart:math';

import 'package:dio/dio.dart';
import 'package:machinery/core/constants/api_keys.dart';

/// Attaches `Idempotency-Key` to every mutating request so a retry — whether
/// from the retry interceptor or from the offline queue — can never create a
/// second transfer or a second expense.
///
/// The key is derived from the request's `clientUuid` when it has one, so the
/// same logical operation keeps the same key across attempts. A key generated
/// fresh per retry would defeat the entire mechanism.
class IdempotencyInterceptor extends Interceptor {
  static const Set<String> _mutatingMethods = <String>{'POST', 'PUT', 'PATCH'};

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (!_mutatingMethods.contains(options.method.toUpperCase())) {
      handler.next(options);
      return;
    }

    if (options.headers.containsKey('Idempotency-Key')) {
      handler.next(options);
      return;
    }

    options.headers['Idempotency-Key'] =
        _clientUuidOf(options.data) ?? generateUuidV4();
    handler.next(options);
  }

  String? _clientUuidOf(dynamic data) {
    if (data is Map<String, dynamic>) {
      final dynamic clientUuid = data[ApiKeys.clientUuid];
      if (clientUuid is String && clientUuid.trim().isNotEmpty) {
        return clientUuid;
      }
    }
    return null;
  }
}

final Random _random = Random.secure();

/// UUID v4 built from the platform's secure RNG. Also used when staging an
/// operation offline so the queued item and the eventual request share a key.
String generateUuidV4() {
  final List<int> bytes = List<int>.generate(16, (_) => _random.nextInt(256));

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  final String hex =
      bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();

  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-'
      '${hex.substring(20)}';
}
