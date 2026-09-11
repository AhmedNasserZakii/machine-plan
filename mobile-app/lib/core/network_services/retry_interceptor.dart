import 'package:dio/dio.dart';
import 'package:machinery/core/resources/debug_print.dart';

/// Retries only what is worth retrying: timeouts, connection errors and the
/// three gateway statuses. A `4xx` is the client's fault — retrying it just
/// burns a bad connection.
class RetryInterceptor extends Interceptor {
  RetryInterceptor({required this.dio});

  final Dio dio;

  static const int _maxAttempts = 3;
  static const List<Duration> _backoff = <Duration>[
    Duration(seconds: 1),
    Duration(seconds: 2),
    Duration(seconds: 4),
  ];
  static const Set<int> _retryableStatuses = <int>{502, 503, 504};
  static const String _attemptKey = 'retry_attempt';

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final int attempt = (err.requestOptions.extra[_attemptKey] as int?) ?? 0;

    if (!_isRetryable(err) || attempt >= _maxAttempts) {
      handler.next(err);
      return;
    }

    await Future<void>.delayed(_backoff[attempt]);

    final RequestOptions options = err.requestOptions
      ..extra[_attemptKey] = attempt + 1;

    try {
      final Response<dynamic> response = await dio.fetch<dynamic>(options);
      handler.resolve(response);
    } on DioException catch (retryError) {
      printDebug(
        message: 'retry interceptor attempt ${attempt + 1} failed: '
            '${retryError.message}',
      );
      handler.next(retryError);
    }
  }

  bool _isRetryable(DioException err) {
    if (err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.connectionError) {
      return true;
    }

    final int? statusCode = err.response?.statusCode;
    return statusCode != null && _retryableStatuses.contains(statusCode);
  }
}
