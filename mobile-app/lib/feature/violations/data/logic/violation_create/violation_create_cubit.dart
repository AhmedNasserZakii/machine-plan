import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/core/lookups/lookups_repo.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/violations/data/logic/violation_create/violation_create_state.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/params/violation_action_params.dart';
import 'package:machinery/feature/violations/domain/repos/violations_repo.dart';

/// Hand-raising a violation — the register's manual-entry counterpart to the
/// return-leg detector.
class ViolationCreateCubit extends Cubit<ViolationCreateState> {
  ViolationCreateCubit({required this.violationsRepo})
    : super(const ViolationCreateLoading());

  final ViolationsRepo violationsRepo;

  Future<void> load() async {
    if (isClosed) return;

    emit(const ViolationCreateLoading());

    final Either<ServerFailure, List<LookupEntity>> result =
        await getIt<LookupsRepo>().violationTypes();

    if (isClosed) return;

    result.fold(
      (ServerFailure failure) => emit(
        ViolationCreateLoadFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (List<LookupEntity> types) => emit(ViolationCreateReady(types: types)),
    );
  }

  /// Severity starts at the type's own default and stays editable — the
  /// reviewer's judgement on the spot can outrank the catalogue.
  void selectType(String typeId) {
    final ViolationCreateState current = state;
    if (current is! ViolationCreateReady) return;

    final ViolationTypeEntity? match = current.types
        .cast<ViolationTypeEntity?>()
        .firstWhere((LookupEntity? t) => t?.id == typeId, orElse: () => null);

    emit(
      current.copyWith(
        typeId: typeId,
        severity: match?.defaultSeverity ?? current.severity,
      ),
    );
  }

  void selectSeverity(ViolationSeverity severity) {
    final ViolationCreateState current = state;
    if (current is! ViolationCreateReady) return;

    emit(current.copyWith(severity: severity));
  }

  void selectUser(UserEntity user) {
    final ViolationCreateState current = state;
    if (current is! ViolationCreateReady) return;

    emit(current.copyWith(user: user));
  }

  void selectMachine(MachineEntity? machine) {
    final ViolationCreateState current = state;
    if (current is! ViolationCreateReady) return;

    emit(current.copyWith(machine: machine, clearMachine: machine == null));
  }

  Future<void> submit({required String description}) async {
    final ViolationCreateState current = state;
    if (current is! ViolationCreateReady || current.isSubmitting) return;

    final String? typeId = current.typeId;
    final ViolationSeverity? severity = current.severity;
    final UserEntity? user = current.user;
    if (typeId == null || severity == null || user == null) return;

    emit(current.copyWith(isSubmitting: true));

    final Either<ServerFailure, ViolationEntity> result = await violationsRepo
        .createViolation(
          params: CreateViolationParams(
            violationTypeId: typeId,
            userId: user.id,
            severity: severity,
            description: description,
            machineId: current.machine?.id,
          ),
        );

    if (isClosed) return;

    result.fold(
      (ServerFailure failure) {
        emit(ViolationCreateSubmitFailure(errorMessage: failure.errorMessage));
        emit(current.copyWith(isSubmitting: false));
      },
      (ViolationEntity violation) =>
          emit(ViolationCreateSubmitted(violation: violation)),
    );
  }
}
