import 'package:equatable/equatable.dart';

sealed class NotificationBadgeState extends Equatable {
  const NotificationBadgeState();

  int get unread => 0;

  @override
  List<Object?> get props => <Object?>[];
}

class NotificationBadgeInitial extends NotificationBadgeState {
  const NotificationBadgeInitial();
}

class NotificationBadgeLoaded extends NotificationBadgeState {
  const NotificationBadgeLoaded({required this.count});

  final int count;

  @override
  int get unread => count;

  @override
  List<Object?> get props => <Object?>[count];
}
