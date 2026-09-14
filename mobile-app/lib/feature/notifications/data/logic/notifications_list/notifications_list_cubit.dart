import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/notifications/data/logic/notification_badge/notification_badge_cubit.dart';
import 'package:machinery/feature/notifications/data/logic/notifications_list/notifications_list_state.dart';
import 'package:machinery/feature/notifications/domain/entities/notification_entity.dart';
import 'package:machinery/feature/notifications/domain/params/notifications_query_params.dart';
import 'package:machinery/feature/notifications/domain/repos/notifications_repo.dart';

class NotificationsListCubit extends Cubit<NotificationsListState> {
  NotificationsListCubit({required this.notificationsRepo})
    : super(const NotificationsListInitial());

  final NotificationsRepo notificationsRepo;

  Future<void> load({
    NotificationsQueryParams? params,
    bool showLoader = true,
  }) async {
    if (isClosed) {
      return;
    }

    final NotificationsQueryParams query = (params ?? _currentQuery).copyWith(
      page: 1,
    );

    if (showLoader) {
      emit(const NotificationsListLoading());
    }

    final result = await notificationsRepo.fetchNotifications(params: query);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        NotificationsListFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (NotificationsPage page) {
        emit(
          NotificationsListLoaded(
            notifications: page.notifications,
            query: query,
            hasNext: page.meta.hasNext,
            total: page.meta.total,
          ),
        );
        // Opening the list is a good moment to refresh the badge from truth.
        getIt<NotificationBadgeCubit>().refresh();
      },
    );
  }

  Future<void> loadMore() async {
    final NotificationsListState current = state;

    if (current is! NotificationsListLoaded ||
        current.isLoadingMore ||
        !current.hasNext) {
      return;
    }

    emit(current.copyWith(isLoadingMore: true));

    final NotificationsQueryParams next = current.query.copyWith(
      page: current.query.page + 1,
    );

    final result = await notificationsRepo.fetchNotifications(params: next);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure _) => emit(current.copyWith(isLoadingMore: false)),
      (NotificationsPage page) => emit(
        current.copyWith(
          notifications: <NotificationEntity>[
            ...current.notifications,
            ...page.notifications,
          ],
          query: next,
          hasNext: page.meta.hasNext,
          total: page.meta.total,
          isLoadingMore: false,
        ),
      ),
    );
  }

  Future<NotificationEntity?> markRead(String id) async {
    final NotificationsListState current = state;
    if (current is! NotificationsListLoaded) {
      return null;
    }

    NotificationEntity? existing;
    for (final NotificationEntity n in current.notifications) {
      if (n.id == id) {
        existing = n;
        break;
      }
    }

    if (existing == null || existing.isRead) {
      return existing;
    }

    final result = await notificationsRepo.markRead(id: id);

    return result.fold(
      (ServerFailure _) => null,
      (NotificationEntity updated) {
        replaceNotification(updated);
        getIt<NotificationBadgeCubit>().applyDelta(-1);
        return updated;
      },
    );
  }

  Future<void> markAllRead() async {
    final NotificationsListState current = state;
    if (current is! NotificationsListLoaded || current.isMarkingAll) {
      return;
    }

    emit(current.copyWith(isMarkingAll: true));

    final result = await notificationsRepo.markAllRead();

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure _) => emit(current.copyWith(isMarkingAll: false)),
      (int _) {
        final DateTime now = DateTime.now();
        emit(
          current.copyWith(
            isMarkingAll: false,
            notifications: current.notifications
                .map(
                  (NotificationEntity n) => n.isRead
                      ? n
                      : n.copyWith(isRead: true, readAt: now),
                )
                .toList(growable: false),
          ),
        );
        getIt<NotificationBadgeCubit>().setCount(0);
      },
    );
  }

  void replaceNotification(NotificationEntity updated) {
    final NotificationsListState current = state;
    if (current is! NotificationsListLoaded) {
      return;
    }

    emit(
      current.copyWith(
        notifications: current.notifications
            .map(
              (NotificationEntity notification) =>
                  notification.id == updated.id ? updated : notification,
            )
            .toList(growable: false),
      ),
    );
  }

  NotificationsQueryParams get _currentQuery {
    final NotificationsListState current = state;
    return current is NotificationsListLoaded
        ? current.query
        : const NotificationsQueryParams();
  }
}
