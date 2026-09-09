import 'package:equatable/equatable.dart';

abstract class UserActionsState extends Equatable {
  const UserActionsState();

  @override
  List<Object?> get props => <Object?>[];
}

class UserActionsIdle extends UserActionsState {
  const UserActionsIdle({required this.isActive});

  final bool isActive;

  @override
  List<Object?> get props => <Object?>[isActive];
}

class UserActionsBusy extends UserActionsState {
  const UserActionsBusy();
}

class UserActionsSucceeded extends UserActionsState {
  const UserActionsSucceeded({required this.messageKey});

  final String messageKey;

  @override
  List<Object?> get props => <Object?>[messageKey];
}

class UserActionsFailed extends UserActionsState {
  const UserActionsFailed({required this.errorMessage});

  final String errorMessage;

  @override
  List<Object?> get props => <Object?>[errorMessage];
}
