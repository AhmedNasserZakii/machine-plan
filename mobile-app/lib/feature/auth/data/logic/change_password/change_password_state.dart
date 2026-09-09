import 'package:equatable/equatable.dart';

abstract class ChangePasswordState extends Equatable {
  const ChangePasswordState();

  @override
  List<Object?> get props => <Object?>[];
}

class ChangePasswordInitial extends ChangePasswordState {
  const ChangePasswordInitial();
}

class ChangePasswordLoading extends ChangePasswordState {
  const ChangePasswordLoading();
}

class ChangePasswordSuccess extends ChangePasswordState {
  const ChangePasswordSuccess();
}

class ChangePasswordFailure extends ChangePasswordState {
  const ChangePasswordFailure({
    required this.errorMessage,
    this.fieldErrors = const <String, String>{},
  });

  final String errorMessage;
  final Map<String, String> fieldErrors;

  @override
  List<Object?> get props => <Object?>[errorMessage, fieldErrors];
}
