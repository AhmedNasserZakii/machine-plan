import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/helper/app_validator.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_cubit.dart';
import 'package:machinery/feature/auth/data/logic/login/login_state.dart';
import 'package:machinery/feature/auth/domain/params/login_params.dart';
import 'package:machinery/feature/auth/domain/repos/auth_repo.dart';

class LoginCubit extends Cubit<LoginState> {
  LoginCubit({required this.authRepo, required this.authCubit})
    : super(const LoginInitial());

  final AuthRepo authRepo;
  final AuthCubit authCubit;

  Future<void> login({required String phone, required String password}) async {
    if (isClosed) {
      return;
    }

    emit(const LoginLoading());

    final result = await authRepo.login(
      params: LoginParams(
        phone: AppValidators.normalizeEgyptianPhone(phone),
        password: password,
        deviceId: LocalStorage.getDeviceId(),
      ),
    );

    if (isClosed) {
      return;
    }

    await result.fold(
      (failure) async {
        if (!isClosed) {
          emit(
            LoginFailure(
              errorMessage: failure.errorMessage,
              fieldErrors: failure.fieldErrors,
            ),
          );
        }
      },
      (session) async {
        // The repository already stored the tokens; this publishes the session
        // so navigation and permission gating pick it up.
        await authCubit.onAuthenticated(session.profile);

        if (!isClosed) {
          emit(LoginSuccess(profile: session.profile));
        }
      },
    );
  }
}
