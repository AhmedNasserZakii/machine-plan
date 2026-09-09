import 'package:equatable/equatable.dart';
import 'package:machinery/feature/auth/domain/entities/auth_profile_entity.dart';

abstract class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => <Object?>[];
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthChecking extends AuthState {
  const AuthChecking();
}

class Authenticated extends AuthState {
  const Authenticated({required this.profile, this.isFromCache = false});

  final AuthProfileEntity profile;

  /// True when the session was restored from local storage because the device
  /// had no signal. The UI is fully usable; the profile is just not fresh.
  final bool isFromCache;

  bool get mustChangePassword => profile.user.mustChangePassword;

  @override
  List<Object?> get props => <Object?>[profile, isFromCache];
}

class Unauthenticated extends AuthState {
  const Unauthenticated({this.reason});

  final String? reason;

  @override
  List<Object?> get props => <Object?>[reason];
}
