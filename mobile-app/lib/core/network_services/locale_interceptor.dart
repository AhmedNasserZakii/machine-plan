import 'package:dio/dio.dart';
import 'package:machinery/core/config/app_environment.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/upgrade_required_handler.dart';

/// Attaches locale / device / client-version headers and reacts to forced
/// upgrades (HTTP 426 / `CLIENT_UPGRADE_REQUIRED`).
class LocaleInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers['Accept-Language'] = LocalStorage.getLocaleLanguage();
    options.headers['X-Client-Version'] = AppEnvironment.clientVersion;

    final String deviceId = LocalStorage.getDeviceId();
    if (deviceId.isNotEmpty) {
      options.headers['X-Device-Id'] = deviceId;
    }

    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final failure = ServerFailure.fromDioException(err);
    if (failure is UpgradeRequiredFailure ||
        err.response?.statusCode == 426 ||
        failure.code == 'CLIENT_UPGRADE_REQUIRED') {
      final upgrade = failure is UpgradeRequiredFailure
          ? failure
          : UpgradeRequiredFailure(
              failure.errorMessage,
              code: failure.code,
              statusCode: failure.statusCode ?? err.response?.statusCode,
            );
      await UpgradeRequiredHandler.handle(
        message: upgrade.errorMessage,
        minVersion: upgrade.minVersion,
      );
    }
    handler.next(err);
  }
}
