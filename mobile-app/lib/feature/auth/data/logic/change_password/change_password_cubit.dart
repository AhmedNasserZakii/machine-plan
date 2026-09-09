import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_cubit.dart';
import 'package:machinery/feature/auth/data/logic/change_password/change_password_state.dart';
import 'package:machinery/feature/auth/domain/params/change_password_params.dart';
import 'package:machinery/feature/auth/domain/repos/auth_repo.dart';

class ChangePasswordCubit extends Cubit<ChangePasswordState> {
  ChangePasswordCubit({required this.authRepo, required this.authCubit})
    : super(const ChangePasswordInitial());

  final AuthRepo authRepo;
  final AuthCubit authCubit;

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    if (isClosed) {
      return;
    }

    emit(const ChangePasswordLoading());

    final result = await authRepo.changePassword(
      params: ChangePasswordParams(
        currentPassword: currentPassword,
        newPassword: newPassword,
      ),
    );

    if (isClosed) {
      return;
    }

    result.fold(
      (failure) {
        if (!isClosed) {
          emit(
            ChangePasswordFailure(
              errorMessage: failure.errorMessage,
              fieldErrors: failure.fieldErrors,
            ),
          );
        }
      },
      (_) {
        // Clears the forced-change flag so the blocking screen lets go.
        authCubit.onPasswordChanged();
        if (!isClosed) {
          emit(const ChangePasswordSuccess());
        }
      },
    );
  }
}
