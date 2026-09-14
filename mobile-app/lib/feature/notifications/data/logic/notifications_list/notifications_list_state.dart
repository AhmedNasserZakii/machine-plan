import 'package:equatable/equatable.dart';
import 'package:machinery/feature/notifications/domain/entities/notification_entity.dart';
import 'package:machinery/feature/notifications/domain/params/notifications_query_params.dart';

sealed class NotificationsListState extends Equatable {
  const NotificationsListState();

  @override
  List<Object?> get props => <Object?>[];
}

class NotificationsListInitial extends NotificationsListState {
  const NotificationsListInitial();
}

class NotificationsListLoading extends NotificationsListState {
  const NotificationsListLoading();
}

class NotificationsListLoaded extends NotificationsListState {
  const NotificationsListLoaded({
    required this.notifications,
    required this.query,
    required this.hasNext,
    required this.total,
    this.isLoadingMore = false,
    this.isMarkingAll = false,
  });

  final List<NotificationEntity> notifications;
  final NotificationsQueryParams query;
  final bool hasNext;
  final int total;
  final bool isLoadingMore;
  final bool isMarkingAll;

  bool get hasUnread =>
      notifications.any((NotificationEntity n) => !n.isRead);

  NotificationsListLoaded copyWith({
    List<NotificationEntity>? notifications,
    NotificationsQueryParams? query,
    bool? hasNext,
    int? total,
    bool? isLoadingMore,
    bool? isMarkingAll,
  }) {
    return NotificationsListLoaded(
      notifications: notifications ?? this.notifications,
      query: query ?? this.query,
      hasNext: hasNext ?? this.hasNext,
      total: total ?? this.total,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      isMarkingAll: isMarkingAll ?? this.isMarkingAll,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    notifications,
    query,
    hasNext,
    total,
    isLoadingMore,
    isMarkingAll,
  ];
}

class NotificationsListFailure extends NotificationsListState {
  const NotificationsListFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
