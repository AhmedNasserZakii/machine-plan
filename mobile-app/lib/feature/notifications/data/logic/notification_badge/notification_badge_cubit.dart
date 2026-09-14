import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/notifications/data/logic/notification_badge/notification_badge_state.dart';
import 'package:machinery/feature/notifications/domain/repos/notifications_repo.dart';

/// App-wide unread count. Singleton so the More tab badge and list stay in
/// sync without a shared parent widget.
class NotificationBadgeCubit extends Cubit<NotificationBadgeState> {
  NotificationBadgeCubit({required this.notificationsRepo})
    : super(const NotificationBadgeInitial());

  final NotificationsRepo notificationsRepo;

  Future<void> refresh() async {
    final result = await notificationsRepo.unreadCount();

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure _) {
        // Keep the last known count on a failed poll (offline resume).
      },
      (int count) => emit(NotificationBadgeLoaded(count: count < 0 ? 0 : count)),
    );
  }

  void applyDelta(int delta) {
    final int current = state.unread;
    final int next = current + delta;
    emit(NotificationBadgeLoaded(count: next < 0 ? 0 : next));
  }

  void setCount(int count) {
    emit(NotificationBadgeLoaded(count: count < 0 ? 0 : count));
  }

  void clear() {
    emit(const NotificationBadgeLoaded(count: 0));
  }
}
