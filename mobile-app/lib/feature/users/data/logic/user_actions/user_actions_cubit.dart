import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/users/data/logic/user_actions/user_actions_state.dart';
import 'package:machinery/feature/users/domain/repos/users_repo.dart';

/// The account-level actions that sit beside the edit form: suspend, restore
/// and reset the password.
class UserActionsCubit extends Cubit<UserActionsState> {
  UserActionsCubit({
    required this.usersRepo,
    required this.userId,
    required bool isActive,
  }) : _isActive = isActive,
       super(UserActionsIdle(isActive: isActive));

  final UsersRepo usersRepo;
  final String userId;

  /// The last state the server confirmed. Only moved on success, so a failed
  /// suspend leaves the button showing what is actually true.
  bool _isActive;

  Future<void> setActive({required bool isActive}) async {
    if (state is UserActionsBusy) {
      return;
    }

    emit(const UserActionsBusy());

    final Either<ServerFailure, Unit> result = await usersRepo.setUserActive(
      id: userId,
      isActive: isActive,
    );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) {
        // A 409 here means the account still holds machines. That is a real
        // rule, not a glitch: custody has to move with a signature, so there
        // is deliberately no force option.
        emit(
          UserActionsFailed(
            errorMessage: failure is ConflictFailure
                ? LocaleKeys.userHasCustody
                : failure.errorMessage,
          ),
        );
        emit(UserActionsIdle(isActive: _isActive));
      },
      (_) {
        _isActive = isActive;
        emit(
          UserActionsSucceeded(
            messageKey: isActive
                ? LocaleKeys.userActivated
                : LocaleKeys.userDeactivated,
          ),
        );
        emit(UserActionsIdle(isActive: _isActive));
      },
    );
  }

  Future<void> resetPassword(String newPassword) async {
    if (state is UserActionsBusy) {
      return;
    }

    emit(const UserActionsBusy());

    final Either<ServerFailure, Unit> result = await usersRepo.resetPassword(
      id: userId,
      newPassword: newPassword,
    );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) {
        emit(UserActionsFailed(errorMessage: failure.errorMessage));
        emit(UserActionsIdle(isActive: _isActive));
      },
      (_) {
        emit(
          const UserActionsSucceeded(
            messageKey: LocaleKeys.userResetPasswordDone,
          ),
        );
        emit(UserActionsIdle(isActive: _isActive));
      },
    );
  }
}
