import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/machines/data/logic/machine_maintenance_history/machine_maintenance_history_state.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';

class MachineMaintenanceHistoryCubit
    extends Cubit<MachineMaintenanceHistoryState> {
  MachineMaintenanceHistoryCubit({
    required this.machinesRepo,
    required this.machineId,
  }) : super(const MachineMaintenanceHistoryLoading());

  final MachinesRepo machinesRepo;
  final String machineId;

  Future<void> load() async {
    if (isClosed) {
      return;
    }

    emit(const MachineMaintenanceHistoryLoading());

    final result = await machinesRepo.fetchMaintenanceHistory(
      machineId: machineId,
    );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        MachineMaintenanceHistoryFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (history) => emit(MachineMaintenanceHistoryLoaded(history: history)),
    );
  }
}
