import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/feature/notifications/data/models/notification_response_model.dart';
import 'package:machinery/feature/notifications/domain/entities/notification_entity.dart';
import 'package:machinery/feature/notifications/domain/params/notification_preferences_params.dart';
import 'package:machinery/feature/notifications/domain/params/notifications_query_params.dart';
import 'package:machinery/feature/notifications/domain/params/register_device_params.dart';
import 'package:machinery/feature/notifications/domain/repos/notifications_repo.dart';

class NotificationsRepoImpl implements NotificationsRepo {
  NotificationsRepoImpl({required this.apiService, required this.networkInfo});

  final ApiService apiService;
  final NetworkInfo networkInfo;

  @override
  Future<Either<ServerFailure, NotificationsPage>> fetchNotifications({
    required NotificationsQueryParams params,
  }) {
    return _guard('fetchNotifications', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.notifications,
        queryParameters: params.toQuery(),
      );

      final Map<String, dynamic> body = _body(response.data);

      return NotificationsPage(
        notifications: _list(body[ApiKeys.data])
            .map(
              (Map<String, dynamic> json) =>
                  NotificationResponseModel.fromJson(json).toEntity(),
            )
            .toList(growable: false),
        meta: _metaOf(body),
      );
    });
  }

  @override
  Future<Either<ServerFailure, NotificationEntity>> markRead({
    required String id,
  }) {
    return _guard('markRead', () async {
      final Response<dynamic> response = await apiService
          .client()
          .patch<dynamic>(WebConstant.notificationRead(id));

      return NotificationResponseModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, int>> markAllRead({List<String>? ids}) {
    return _guard('markAllRead', () async {
      final Response<dynamic> response = await apiService
          .client()
          .patch<dynamic>(
            WebConstant.notificationsReadAll,
            data: <String, dynamic>{
              if (ids != null && ids.isNotEmpty) ApiKeys.ids: ids,
            },
          );

      final Map<String, dynamic> data = _data(response.data);
      return _int(data[ApiKeys.updated]);
    });
  }

  @override
  Future<Either<ServerFailure, int>> unreadCount() {
    return _guard('unreadCount', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.notificationsUnreadCount,
      );

      final Map<String, dynamic> data = _data(response.data);
      // Backend key is `unread` (not unreadCount).
      return _int(data[ApiKeys.unread]);
    });
  }

  @override
  Future<Either<ServerFailure, NotificationPreferencesEntity>>
  fetchPreferences() {
    return _guard('fetchPreferences', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.notificationPreferences,
      );

      return NotificationPreferencesModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, NotificationPreferencesEntity>>
  updatePreferences({required UpdateNotificationPreferencesParams params}) {
    return _guard('updatePreferences', () async {
      final Response<dynamic> response = await apiService.client().put<dynamic>(
        WebConstant.notificationPreferences,
        data: params.toJson(),
      );

      return NotificationPreferencesModel.fromJson(
        _data(response.data),
      ).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, void>> registerDevice({
    required RegisterDeviceParams params,
  }) {
    return _guard('registerDevice', () async {
      await apiService.client().post<dynamic>(
        WebConstant.devices,
        data: params.toJson(),
      );
    });
  }

  @override
  Future<Either<ServerFailure, void>> unregisterDevice({
    required String deviceId,
  }) {
    return _guard('unregisterDevice', () async {
      await apiService.client().delete<dynamic>(WebConstant.device(deviceId));
    });
  }

  Future<Either<ServerFailure, T>> _guard<T>(
    String label,
    Future<T> Function() run,
  ) async {
    try {
      if (!await networkInfo.isConnected) {
        return Left(OfflineFailure());
      }

      return Right(await run());
    } on DioException catch (error, stackTrace) {
      printDebug(
        message: 'notifications repo $label dio exception: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'notifications repo $label catch: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
    }
  }

  static Map<String, dynamic> _body(dynamic raw) {
    return raw is Map<String, dynamic> ? raw : const <String, dynamic>{};
  }

  static Map<String, dynamic> _data(dynamic raw) {
    final dynamic data = _body(raw)[ApiKeys.data];
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  static List<Map<String, dynamic>> _list(dynamic raw) {
    if (raw is List) {
      return raw.whereType<Map<String, dynamic>>().toList(growable: false);
    }

    if (raw is Map<String, dynamic> && raw[ApiKeys.items] is List) {
      return (raw[ApiKeys.items] as List)
          .whereType<Map<String, dynamic>>()
          .toList(growable: false);
    }

    return const <Map<String, dynamic>>[];
  }

  static PaginationMetaModel _metaOf(Map<String, dynamic> body) {
    final dynamic meta = body[ApiKeys.meta];
    return PaginationMetaModel.fromJson(
      meta is Map<String, dynamic> ? meta : const <String, dynamic>{},
    );
  }

  static int _int(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }
}
