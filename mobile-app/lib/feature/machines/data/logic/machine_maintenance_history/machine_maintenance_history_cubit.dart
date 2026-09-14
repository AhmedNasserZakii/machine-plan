import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/machines/data/logic/machine_maintenance_history/machine_maintenance_history_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_maintenance_history.dart';
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

  Future<void> loadMore() async {
    final MachineMaintenanceHistoryState current = state;
    if (current is! MachineMaintenanceHistoryLoaded ||
        current.isLoadingMore ||
        !current.hasNext) {
      return;
    }

    emit(current.copyWith(isLoadingMore: true));

    final result = await machinesRepo.fetchMaintenanceHistory(
      machineId: machineId,
      page: current.page + 1,
    );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure _) => emit(current.copyWith(isLoadingMore: false)),
      (MachineMaintenanceHistory page) => emit(
        current.copyWith(
          history: current.history.copyWith(
            orders: <MaintenanceOrderSummary>[
              ...current.history.orders,
              ...page.orders,
            ],
            ordersMeta: page.ordersMeta,
          ),
          isLoadingMore: false,
        ),
      ),
    );
  }
}
