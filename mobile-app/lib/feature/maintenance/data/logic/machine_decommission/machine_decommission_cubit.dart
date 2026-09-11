import 'dart:typed_data';

import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/lookups/lookups_repo.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/maintenance/data/logic/machine_decommission/machine_decommission_state.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/domain/repos/maintenance_repo.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';

class MachineDecommissionCubit extends Cubit<MachineDecommissionState> {
  MachineDecommissionCubit({
    required this.machineId,
    required this.maintenanceRepo,
    required this.lookupsRepo,
  }) : super(const MachineDecommissionLoading());

  final String machineId;
  final MaintenanceRepo maintenanceRepo;
  final LookupsRepo lookupsRepo;

  Future<void> load() async {
    emit(const MachineDecommissionLoading());
    final reasonsResult = await lookupsRepo.decommissionReasons();
    final summaryResult = await maintenanceRepo.fetchCostSummary(
      machineId: machineId,
    );
    if (isClosed) return;

    final failure =
        reasonsResult.fold<ServerFailure?>((f) => f, (_) => null) ??
        summaryResult.fold<ServerFailure?>((f) => f, (_) => null);
    if (failure != null) {
      emit(
        MachineDecommissionFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      );
      return;
    }

    emit(
      MachineDecommissionReady(
        reasons: reasonsResult.getOrElse(() => const []),
        summary: summaryResult.getOrElse(
          () => throw StateError('summary checked above'),
        ),
      ),
    );
  }

  Future<void> submit({
    required String reasonId,
    required String notes,
    required String decommissionedAt,
    Uint8List? drawnSignature,
    SignatureParams? biometricSignature,
  }) async {
    final current = state;
    if (current is! MachineDecommissionReady || current.isSubmitting) return;

    emit(current.copyWith(isSubmitting: true, fieldErrors: const {}));

    SignatureParams? signature = biometricSignature;
    if (drawnSignature != null) {
      final upload = await maintenanceRepo.uploadSignature(png: drawnSignature);
      if (isClosed) return;
      final ServerFailure? uploadFailure = upload.fold((f) => f, (_) => null);
      if (uploadFailure != null) {
        emit(
          MachineDecommissionSubmitFailure(
            errorMessage: uploadFailure.errorMessage,
          ),
        );
        emit(current.copyWith(isSubmitting: false));
        return;
      }
      signature = SignatureParams(
        method: SignatureMethod.drawn,
        signatureMediaId: upload.getOrElse(() => ''),
      );
    }

    final Either<ServerFailure, DecommissionEntity> result =
        await maintenanceRepo.decommissionMachine(
          machineId: machineId,
          params: DecommissionMachineParams(
            reasonId: reasonId,
            notes: notes,
            decommissionedAt: decommissionedAt,
            signature: signature,
          ),
        );
    if (isClosed) return;

    result.fold(
      (ServerFailure failure) {
        if (failure.fieldErrors.isNotEmpty) {
          emit(current.copyWith(fieldErrors: failure.fieldErrors));
        } else {
          emit(
            MachineDecommissionSubmitFailure(
              errorMessage: failure.errorMessage,
            ),
          );
          emit(current.copyWith(isSubmitting: false));
        }
      },
      (DecommissionEntity value) =>
          emit(MachineDecommissionSubmitted(decommission: value)),
    );
  }
}
