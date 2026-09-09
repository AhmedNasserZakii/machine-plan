import 'package:equatable/equatable.dart';

abstract class LogoutState extends Equatable {
  const LogoutState();

  @override
  List<Object?> get props => <Object?>[];
}

class LogoutInitial extends LogoutState {
  const LogoutInitial();
}

class LogoutInProgress extends LogoutState {
  const LogoutInProgress();
}

/// The session is gone locally even when the server call failed, so the screen
/// always routes to login from here.
class LogoutDone extends LogoutState {
  const LogoutDone({this.warning});

  /// Set when the token could not be revoked server-side. Worth telling the
  /// user, but it must not keep them signed in.
  final String? warning;

  @override
  List<Object?> get props => <Object?>[warning];
}
