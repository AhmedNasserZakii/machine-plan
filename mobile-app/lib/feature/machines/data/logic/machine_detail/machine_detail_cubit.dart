import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/machines/data/logic/machine_detail/machine_detail_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';

class MachineDetailCubit extends Cubit<MachineDetailState> {
  /// [initial] is the row the list already has. Showing it immediately means
  /// the screen opens with the serial and status filled in while the full
  /// record loads, instead of a spinner over information the app already holds.
  MachineDetailCubit({
    required this.machinesRepo,
    required this.machineId,
    MachineEntity? initial,
  }) : super(
         initial == null
             ? const MachineDetailLoading()
             : MachineDetailLoaded(machine: initial),
       );

  final MachinesRepo machinesRepo;
  final String machineId;

  Future<void> load() async {
    final MachineDetailState previous = state;

    final result = await machinesRepo.fetchMachine(id: machineId);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) {
        // A refresh that fails over a record already on screen should leave it
        // there: stale detail beats an error page the user cannot act on.
        if (previous is MachineDetailLoaded) {
          return;
        }

        emit(
          MachineDetailFailure(
            errorMessage: failure.errorMessage,
            isOffline: failure is OfflineFailure,
          ),
        );
      },
      (MachineEntity machine) {
        emit(MachineDetailLoaded(machine: machine));
        if (machine.isPartOfChain) {
          _loadChain();
        }
      },
    );
  }

  /// Called after the form saves, so the detail reflects the edit without a
  /// round trip.
  void applyUpdate(MachineEntity updated) {
    final MachineDetailState current = state;
    if (current is MachineDetailLoaded) {
      emit(current.copyWith(machine: updated));
      return;
    }

    emit(MachineDetailLoaded(machine: updated));
  }

  Future<void> _loadChain() async {
    final result = await machinesRepo.fetchReplacementChain(id: machineId);

    if (isClosed) {
      return;
    }

    final MachineDetailState current = state;
    if (current is! MachineDetailLoaded) {
      return;
    }

    // The chain is supporting detail, not the point of the screen: if it fails
    // the card simply does not render.
    result.fold(
      (ServerFailure _) => null,
      (List<MachineEntity> chain) => emit(current.copyWith(chain: chain)),
    );
  }
}
