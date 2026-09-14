import 'package:dartz/dartz.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/feature/notifications/domain/entities/notification_entity.dart';
import 'package:machinery/feature/notifications/domain/params/notification_preferences_params.dart';
import 'package:machinery/feature/notifications/domain/params/notifications_query_params.dart';
import 'package:machinery/feature/notifications/domain/params/register_device_params.dart';

class NotificationsPage {
  const NotificationsPage({
    required this.notifications,
    required this.meta,
  });

  final List<NotificationEntity> notifications;
  final PaginationMetaModel meta;
}

abstract class NotificationsRepo {
  Future<Either<ServerFailure, NotificationsPage>> fetchNotifications({
    required NotificationsQueryParams params,
  });

  Future<Either<ServerFailure, NotificationEntity>> markRead({
    required String id,
  });

  Future<Either<ServerFailure, int>> markAllRead({List<String>? ids});

  Future<Either<ServerFailure, int>> unreadCount();

  Future<Either<ServerFailure, NotificationPreferencesEntity>>
  fetchPreferences();

  Future<Either<ServerFailure, NotificationPreferencesEntity>>
  updatePreferences({required UpdateNotificationPreferencesParams params});

  Future<Either<ServerFailure, void>> registerDevice({
    required RegisterDeviceParams params,
  });

  Future<Either<ServerFailure, void>> unregisterDevice({
    required String deviceId,
  });
}
