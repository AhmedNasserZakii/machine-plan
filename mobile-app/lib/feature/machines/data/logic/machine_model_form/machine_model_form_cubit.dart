import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/machines/data/logic/machine_model_form/machine_model_form_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/domain/params/machine_model_form_params.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';

/// Create or edit a catalogue model. [existing] null means create — there is
/// no separate mode flag to keep in sync.
class MachineModelFormCubit extends Cubit<MachineModelFormState> {
  MachineModelFormCubit({required this.machinesRepo, this.existing})
    : super(const MachineModelFormLoading());

  final MachinesRepo machinesRepo;
  final MachineModelEntity? existing;

  bool get isEditing => existing != null;

  Future<void> load() async {
    if (isClosed) {
      return;
    }

    emit(const MachineModelFormLoading());

    final Either<ServerFailure, List<MachineTypeEntity>> result =
        await machinesRepo.fetchMachineTypes();

    if (isClosed) {
      return;
    }

    if (result.isLeft()) {
      final ServerFailure failure = result.swap().getOrElse(
        () => ServerFailure(''),
      );
      emit(
        MachineModelFormLoadFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      );
      return;
    }

    final List<MachineTypeEntity> types = result.getOrElse(
      () => <MachineTypeEntity>[],
    );

    emit(
      MachineModelFormReady(
        types: types,
        selectedType: _initialType(types),
        isActive: existing?.isActive ?? true,
      ),
    );
  }

  void selectType(MachineTypeEntity type) {
    final MachineModelFormState current = state;
    if (current is! MachineModelFormReady) {
      return;
    }

    emit(
      current.copyWith(
        selectedType: type,
        fieldErrors: const <String, String>{},
      ),
    );
  }

  void setActive(bool isActive) {
    final MachineModelFormState current = state;
    if (current is! MachineModelFormReady) {
      return;
    }

    emit(current.copyWith(isActive: isActive));
  }

  Future<void> submit({
    required String code,
    required String nameAr,
    required String nameEn,
    String? manufacturer,
  }) async {
    final MachineModelFormState current = state;
    if (current is! MachineModelFormReady ||
        current.isSubmitting ||
        current.selectedType == null) {
      return;
    }

    emit(
      current.copyWith(
        isSubmitting: true,
        fieldErrors: const <String, String>{},
      ),
    );

    final Either<ServerFailure, MachineModelEntity> result = isEditing
        ? await machinesRepo.updateMachineModel(
            id: existing!.id,
            params: UpdateMachineModelParams(
              nameAr: nameAr,
              nameEn: nameEn,
              machineTypeId: current.selectedType!.id,
              isActive: current.isActive,
              manufacturer: manufacturer,
            ),
          )
        : await machinesRepo.createMachineModel(
            params: CreateMachineModelParams(
              code: code,
              nameAr: nameAr,
              nameEn: nameEn,
              machineTypeId: current.selectedType!.id,
              manufacturer: manufacturer,
            ),
          );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) {
        if (failure.fieldErrors.isNotEmpty) {
          emit(
            current.copyWith(
              isSubmitting: false,
              fieldErrors: failure.fieldErrors,
            ),
          );
          return;
        }

        emit(MachineModelFormSubmitFailure(errorMessage: failure.errorMessage));
        emit(current.copyWith(isSubmitting: false));
      },
      (MachineModelEntity model) => emit(
        MachineModelFormSubmitted(model: model, wasCreated: !isEditing),
      ),
    );
  }

  MachineTypeEntity? _initialType(List<MachineTypeEntity> types) {
    final MachineModelEntity? existing = this.existing;
    if (existing == null) {
      return types.isEmpty ? null : types.first;
    }

    for (final MachineTypeEntity type in types) {
      if (type.id == existing.type.id) {
        return type;
      }
    }

    return existing.type;
  }
}
