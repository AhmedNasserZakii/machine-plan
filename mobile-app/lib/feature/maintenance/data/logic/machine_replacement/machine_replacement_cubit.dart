import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';
import 'package:machinery/feature/maintenance/data/logic/machine_replacement/machine_replacement_state.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/domain/repos/maintenance_repo.dart';

class MachineReplacementCubit extends Cubit<MachineReplacementState> {
  MachineReplacementCubit({
    required this.maintenanceRepo,
    required this.machinesRepo,
    required this.machine,
  }) : super(const MachineReplacementReady());

  final MaintenanceRepo maintenanceRepo;
  final MachinesRepo machinesRepo;
  final MachineEntity machine;

  Future<void> submit(ReplacementMachineParams params) async {
    final MachineReplacementState current = state;
    if (current is! MachineReplacementReady || current.isSubmitting) return;

    emit(const MachineReplacementReady(isSubmitting: true));

    final Either<ServerFailure, MachineReplacedEntity> result =
        await maintenanceRepo.replaceMachine(
          machineId: machine.id,
          params: params,
        );

    if (isClosed) return;

    await result.fold(
      (ServerFailure failure) async {
        final Map<String, String> fieldErrors = failure.fieldErrors.isNotEmpty
            ? failure.fieldErrors
            : _duplicateFieldError(failure);
        if (fieldErrors.isNotEmpty) {
          emit(MachineReplacementReady(fieldErrors: fieldErrors));
          return;
        }
        emit(MachineReplacementFailure(errorMessage: failure.errorMessage));
        emit(const MachineReplacementReady());
      },
      (MachineReplacedEntity outcome) async {
        // The replacement is already committed. Fetching both records here is
        // part of completing the flow, not an optional refresh left to two
        // different screens to remember independently.
        final oldResult = await machinesRepo.fetchMachine(
          id: outcome.oldMachineId,
        );
        final newResult = await machinesRepo.fetchMachine(
          id: outcome.newMachineId,
        );

        if (isClosed) return;

        final MachineEntity? oldMachine = oldResult.fold(
          (_) => null,
          (MachineEntity value) => value,
        );
        final MachineEntity? newMachine = newResult.fold(
          (_) => null,
          (MachineEntity value) => value,
        );

        if (oldMachine == null || newMachine == null) {
          // The write succeeded but a follow-up read did not. Returning to the
          // old detail and reloading is safer than offering another submit.
          emit(
            MachineReplacementRefreshFailure(
              errorMessage: (oldResult.isLeft() ? oldResult : newResult).fold(
                (ServerFailure failure) => failure.errorMessage,
                (_) => '',
              ),
            ),
          );
          return;
        }

        emit(
          MachineReplacementSubmitted(
            oldMachine: oldMachine,
            newMachine: newMachine,
          ),
        );
      },
    );
  }

  Map<String, String> _duplicateFieldError(ServerFailure failure) {
    final String? field = switch (failure.code) {
      'SERIAL_EXISTS' => 'newSerial',
      'BATTERY_SERIAL_EXISTS' => 'newBattery.serial',
      'SIM_SERIAL_EXISTS' => 'newSimSerial',
      'BOX_SERIAL_EXISTS' => 'newBoxSerial',
      _ => null,
    };
    return field == null
        ? const <String, String>{}
        : <String, String>{field: failure.errorMessage};
  }
}
