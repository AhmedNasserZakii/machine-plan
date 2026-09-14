import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/notifications/data/logic/notification_badge/notification_badge_cubit.dart';
import 'package:machinery/feature/notifications/data/logic/notification_badge/notification_badge_state.dart';
import 'package:machinery/feature/notifications/data/logic/notifications_list/notifications_list_cubit.dart';
import 'package:machinery/feature/notifications/data/logic/notifications_list/notifications_list_state.dart';
import 'package:machinery/feature/notifications/domain/entities/notification_entity.dart';
import 'package:machinery/feature/notifications/domain/params/notifications_query_params.dart';
import 'package:machinery/feature/notifications/domain/repos/notifications_repo.dart';

NotificationEntity _notification(String id, {bool isRead = false}) {
  return NotificationEntity(
    id: id,
    templateCode: NotificationTemplateCode.transferPending,
    title: 'Pending',
    body: 'Needs signature',
    locale: 'en',
    isRead: isRead,
    data: const <String, String>{},
    deepLink: 'machinery://transfers/$id',
    createdAt: DateTime(2026, 9, 14),
  );
}

class _FakeNotificationsRepo implements NotificationsRepo {
  Either<ServerFailure, NotificationsPage>? pageResult;
  Either<ServerFailure, NotificationEntity>? markReadResult;
  Either<ServerFailure, int>? unreadResult;
  int unreadCalls = 0;

  @override
  Future<Either<ServerFailure, NotificationsPage>> fetchNotifications({
    required NotificationsQueryParams params,
  }) async {
    return pageResult ?? Left(ServerFailure(''));
  }

  @override
  Future<Either<ServerFailure, NotificationEntity>> markRead({
    required String id,
  }) async {
    return markReadResult ?? Left(ServerFailure(''));
  }

  @override
  Future<Either<ServerFailure, int>> unreadCount() async {
    unreadCalls++;
    return unreadResult ?? const Right(0);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

void main() {
  late _FakeNotificationsRepo repo;

  setUp(() {
    repo = _FakeNotificationsRepo();
    getIt.registerLazySingleton<NotificationBadgeCubit>(
      () => NotificationBadgeCubit(notificationsRepo: repo),
    );
  });

  tearDown(() async {
    await getIt.reset();
  });

  test('load() surfaces an offline failure', () async {
    repo.pageResult = Left(OfflineFailure());

    final NotificationsListCubit cubit = NotificationsListCubit(
      notificationsRepo: repo,
    );

    await cubit.load();

    expect(cubit.state, isA<NotificationsListFailure>());
    expect((cubit.state as NotificationsListFailure).isOffline, isTrue);

    await cubit.close();
  });

  test('markRead() updates the row and decrements the badge', () async {
    repo
      ..pageResult = Right(
        NotificationsPage(
          notifications: <NotificationEntity>[_notification('n1')],
          meta: const PaginationMetaModel(
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
            hasNext: false,
          ),
        ),
      )
      ..markReadResult = Right(
        _notification('n1', isRead: true).copyWith(
          isRead: true,
          readAt: DateTime(2026, 9, 14, 12),
        ),
      )
      ..unreadResult = const Right(3);

    final NotificationBadgeCubit badge = getIt<NotificationBadgeCubit>();
    badge.setCount(3);

    final NotificationsListCubit cubit = NotificationsListCubit(
      notificationsRepo: repo,
    );

    await cubit.load();
    await cubit.markRead('n1');

    final NotificationsListLoaded loaded =
        cubit.state as NotificationsListLoaded;
    expect(loaded.notifications.single.isRead, isTrue);
    expect(badge.state.unread, 2);

    await cubit.close();
  });

  test('badge refresh stores the server unread count', () async {
    repo.unreadResult = const Right(7);

    final NotificationBadgeCubit badge = getIt<NotificationBadgeCubit>();
    await badge.refresh();

    expect(badge.state, isA<NotificationBadgeLoaded>());
    expect(badge.state.unread, 7);
  });
}
