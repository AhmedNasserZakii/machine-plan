import 'package:equatable/equatable.dart';
import 'package:machinery/feature/auth/domain/entities/auth_profile_entity.dart';

abstract class LoginState extends Equatable {
  const LoginState();

  @override
  List<Object?> get props => <Object?>[];
}

class LoginInitial extends LoginState {
  const LoginInitial();
}

class LoginLoading extends LoginState {
  const LoginLoading();
}

class LoginSuccess extends LoginState {
  const LoginSuccess({required this.profile});

  final AuthProfileEntity profile;

  bool get mustChangePassword => profile.user.mustChangePassword;

  @override
  List<Object?> get props => <Object?>[profile];
}

class LoginFailure extends LoginState {
  const LoginFailure({
    required this.errorMessage,
    this.fieldErrors = const <String, String>{},
  });

  final String errorMessage;
  final Map<String, String> fieldErrors;

  @override
  List<Object?> get props => <Object?>[errorMessage, fieldErrors];
}
