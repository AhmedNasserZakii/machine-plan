import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/network_services/idempotency_interceptor.dart';
import 'package:machinery/core/network_services/locale_interceptor.dart';
import 'package:machinery/core/network_services/retry_interceptor.dart';
import 'package:machinery/core/network_services/token_interceptor.dart';
import 'package:machinery/core/network_services/web_constant.dart';

class ApiService {
  Dio client({bool requireAuth = true}) {
    final Dio dio = Dio(
      BaseOptions(
        baseUrl: WebConstant.host,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        // Photo uploads over 3G need the long tail.
        sendTimeout: const Duration(seconds: 60),
        headers: <String, dynamic>{
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Accept-Language': LocalStorage.getLocaleLanguage(),
        },
      ),
    );

    dio.interceptors.addAll(<Interceptor>[
      LocaleInterceptor(),
      TokenInterceptor(requireAuth: requireAuth, dio: dio),
      IdempotencyInterceptor(),
      RetryInterceptor(dio: dio),
      if (kDebugMode)
        LogInterceptor(
          requestHeader: true,
          requestBody: true,
          responseHeader: false,
          responseBody: true,
          logPrint: _redactedLogPrint,
        ),
    ]);

    return dio;
  }

  /// A bare client for presigned storage uploads: no auth header, no retry,
  /// and a long send timeout with room for progress callbacks.
  Dio uploadClient() {
    return Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(minutes: 5),
        receiveTimeout: const Duration(minutes: 2),
      ),
    );
  }
}

const List<String> _redactedMarkers = <String>[
  'authorization',
  'password',
  'accesstoken',
  'refreshtoken',
  'nationalid',
];

/// Debug logging must never print a token, a password or a national ID.
void _redactedLogPrint(Object? object) {
  final String line = object.toString();
  final String lowered = line.toLowerCase();

  if (_redactedMarkers.any(lowered.contains)) {
    debugPrint('[redacted]');
    return;
  }

  debugPrint(line);
}
