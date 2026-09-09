import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/services/sync/pending_sync_counter.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_cubit.dart';
import 'package:machinery/feature/more/data/logic/logout/logout_state.dart';

class LogoutCubit extends Cubit<LogoutState> {
  LogoutCubit({required this.authCubit, required this.pendingSyncCounter})
    : super(const LogoutInitial());

  final AuthCubit authCubit;
  final PendingSyncCounter pendingSyncCounter;

  /// Read before confirming so the dialog can warn about unsent work.
  Future<int> readPendingCount() => pendingSyncCounter.pendingCount();

  /// A failed revoke still clears the device. Leaving someone signed in
  /// because the network dropped is the worse outcome, and the server-side
  /// token expires on its own.
  Future<void> logout() async {
    emit(const LogoutInProgress());

    final ServerFailure? failure = await authCubit.logout();

    if (isClosed) {
      return;
    }

    emit(LogoutDone(warning: failure?.errorMessage));
  }
}
