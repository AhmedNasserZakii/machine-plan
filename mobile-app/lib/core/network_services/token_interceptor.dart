import 'dart:async';

import 'package:dio/dio.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/unauthorized_session_handler.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/resources/debug_print.dart';

/// Attaches the bearer token and, on `401`, refreshes it exactly once.
///
/// Ten parallel requests failing at the same moment must trigger one refresh,
/// not ten. `_refreshCompleter` is that guard: the first 401 starts the
/// refresh, every other 401 awaits the same future and then replays with the
/// new token.
class TokenInterceptor extends Interceptor {
  TokenInterceptor({required this.requireAuth, required this.dio});

  final bool requireAuth;
  final Dio dio;

  static Completer<String?>? _refreshCompleter;
  static const String _retriedKey = 'token_refresh_retried';

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (requireAuth) {
      final String accessToken = await LocalStorage.getAccessToken();
      if (accessToken.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $accessToken';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final bool isUnauthorized = err.response?.statusCode == 401;
    final bool alreadyRetried = err.requestOptions.extra[_retriedKey] == true;

    if (!requireAuth || !isUnauthorized || alreadyRetried) {
      handler.next(err);
      return;
    }

    final String? refreshedToken = await _refreshAccessToken();

    if (refreshedToken == null || refreshedToken.isEmpty) {
      final ServerFailure failure = ServerFailure.fromDioException(err);
      await UnauthorizedSessionHandler.handle(message: failure.errorMessage);
      handler.next(err);
      return;
    }

    final RequestOptions options = err.requestOptions
      ..extra[_retriedKey] = true
      ..headers['Authorization'] = 'Bearer $refreshedToken';

    try {
      handler.resolve(await dio.fetch<dynamic>(options));
    } on DioException catch (replayError) {
      handler.next(replayError);
    }
  }

  Future<String?> _refreshAccessToken() {
    final Completer<String?>? inFlight = _refreshCompleter;
    if (inFlight != null) {
      return inFlight.future;
    }

    final Completer<String?> completer = Completer<String?>();
    _refreshCompleter = completer;

    unawaited(
      _performRefresh()
          // A completer that never completes would leave every later 401 waiting
          // forever, so an unexpected throw has to resolve as "no token".
          .onError<Object>((_, _) => null)
          .then((String? token) {
        _refreshCompleter = null;
        completer.complete(token);
      }),
    );

    return completer.future;
  }

  /// Uses a bare Dio so the refresh call cannot recurse back through this
  /// interceptor when it fails with its own 401.
  Future<String?> _performRefresh() async {
    final String refreshToken = await LocalStorage.getRefreshToken();
    if (refreshToken.isEmpty) {
      return null;
    }

    try {
      final Dio refreshDio = Dio(
        BaseOptions(
          baseUrl: WebConstant.host,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          headers: const <String, dynamic>{
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        ),
      );

      final Response<dynamic> response = await refreshDio.post<dynamic>(
        WebConstant.refresh,
        data: <String, dynamic>{ApiKeys.refreshToken: refreshToken},
      );

      final dynamic body = response.data;
      if (body is! Map<String, dynamic>) {
        return null;
      }

      final dynamic data = body[ApiKeys.data];
      if (data is! Map<String, dynamic>) {
        return null;
      }

      final String accessToken = data[ApiKeys.accessToken] as String? ?? '';
      final String newRefreshToken =
          data[ApiKeys.refreshToken] as String? ?? '';

      if (accessToken.isEmpty) {
        return null;
      }

      await LocalStorage.setAccessToken(accessToken);
      if (newRefreshToken.isNotEmpty) {
        await LocalStorage.setRefreshToken(newRefreshToken);
      }

      return accessToken;
    } catch (error, stackTrace) {
      printDebug(
        message: 'token refresh failed: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return null;
    }
  }
}
