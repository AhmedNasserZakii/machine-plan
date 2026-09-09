import 'package:dio/dio.dart';
import 'package:machinery/core/local_storage/local_storage.dart';

class LocaleInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers['Accept-Language'] = LocalStorage.getLocaleLanguage();

    final String deviceId = LocalStorage.getDeviceId();
    if (deviceId.isNotEmpty) {
      options.headers['X-Device-Id'] = deviceId;
    }

    handler.next(options);
  }
}
