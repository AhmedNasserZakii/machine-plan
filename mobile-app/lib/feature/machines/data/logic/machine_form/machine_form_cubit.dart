import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/machines/data/logic/machine_form/machine_form_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/params/machine_form_params.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';

/// Backs both intake and edit. [existing] being null is what makes it an
/// intake — there is no separate mode flag to keep in sync.
///
/// In edit mode the four serials are not part of the payload at all: the server
/// answers a patch carrying one with `422 SERIAL_IMMUTABLE`, so the form shows
/// them locked rather than letting someone type and then fail.
class MachineFormCubit extends Cubit<MachineFormState> {
  MachineFormCubit({required this.machinesRepo, this.existing})
    : super(const MachineFormLoading());

  final MachinesRepo machinesRepo;
  final MachineEntity? existing;

  bool get isEditing => existing != null;

  Future<void> load() async {
    if (isClosed) {
      return;
    }

    emit(const MachineFormLoading());

    final Either<ServerFailure, List<MachineModelEntity>> result =
        await machinesRepo.fetchMachineModels();

    if (isClosed) {
      return;
    }

    // Without the catalogue there is no form to show: a model is required, and
    // its type is what decides whether a SIM is asked for.
    if (result.isLeft()) {
      final ServerFailure failure = result.swap().getOrElse(
        () => ServerFailure(''),
      );
      emit(
        MachineFormLoadFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      );
      return;
    }

    final List<MachineModelEntity> catalogue = result.getOrElse(
      () => <MachineModelEntity>[],
    );

    // On edit the server refuses a model of a different type (SIM rules are
    // fixed for the unit), so the picker only offers same-type peers.
    final List<MachineModelEntity> models = _modelsForForm(catalogue);
    final MachineModelEntity? selected = _initialModel(models);

    emit(
      MachineFormReady(
        models: models,
        selectedModel: selected,
        warrantyStart: existing?.warranty.start,
        warrantyEnd: existing?.warranty.end,
        hasBox: existing?.hasBox ?? true,
      ),
    );
  }

  void selectModel(MachineModelEntity model) {
    final MachineFormState current = state;
    if (current is! MachineFormReady) {
      return;
    }

    emit(
      current.copyWith(
        selectedModel: model,
        fieldErrors: const <String, String>{},
      ),
    );
  }

  void setWarrantyStart(String? date) {
    final MachineFormState current = state;
    if (current is! MachineFormReady) {
      return;
    }

    emit(
      current.copyWith(warrantyStart: date, clearWarrantyStart: date == null),
    );
  }

  void setWarrantyEnd(String? date) {
    final MachineFormState current = state;
    if (current is! MachineFormReady) {
      return;
    }

    emit(current.copyWith(warrantyEnd: date, clearWarrantyEnd: date == null));
  }

  void setHasBox({required bool hasBox}) {
    final MachineFormState current = state;
    if (current is! MachineFormReady) {
      return;
    }

    emit(current.copyWith(hasBox: hasBox));
  }

  Future<void> submit({
    required String serial,
    required String batterySerial,
    String? simSerial,
    String? boxSerial,
    double? purchasePrice,
    String? purchaseDate,
    String? factoryInvoiceNo,
    String? notes,
  }) async {
    final MachineFormState current = state;
    if (current is! MachineFormReady || current.isSubmitting) {
      return;
    }

    final MachineModelEntity? model = current.selectedModel;
    if (model == null) {
      return;
    }

    emit(
      current.copyWith(
        isSubmitting: true,
        fieldErrors: const <String, String>{},
      ),
    );

    final Either<ServerFailure, MachineEntity> result = isEditing
        ? await machinesRepo.updateMachine(
            id: existing!.id,
            params: UpdateMachineParams(
              machineModelId: model.id,
              purchasePrice: purchasePrice,
              purchaseDate: purchaseDate,
              factoryInvoiceNo: factoryInvoiceNo,
              warrantyStart: current.warrantyStart,
              warrantyEnd: current.warrantyEnd,
              notes: notes,
            ),
          )
        : await machinesRepo.createMachine(
            params: CreateMachineParams(
              serial: serial,
              machineModelId: model.id,
              batterySerial: batterySerial,
              hasBox: current.hasBox,
              // A type that carries no SIM must not be sent one, even if the
              // field held a value before the model was changed.
              simSerial: current.requiresSim ? simSerial : null,
              boxSerial: boxSerial,
              purchasePrice: purchasePrice,
              purchaseDate: purchaseDate,
              factoryInvoiceNo: factoryInvoiceNo,
              warrantyStart: current.warrantyStart,
              warrantyEnd: current.warrantyEnd,
              notes: notes,
            ),
          );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) {
        // Field-level problems belong under the fields. Anything else is a
        // one-off message, announced and then dropped so the form returns to an
        // editable state with the user's input intact.
        if (failure.fieldErrors.isNotEmpty) {
          emit(
            current.copyWith(
              isSubmitting: false,
              fieldErrors: failure.fieldErrors,
            ),
          );
          return;
        }

        emit(MachineFormSubmitFailure(errorMessage: failure.errorMessage));
        emit(current.copyWith(isSubmitting: false));
      },
      (MachineEntity machine) =>
          emit(MachineFormSubmitted(machine: machine, wasCreated: !isEditing)),
    );
  }

  MachineModelEntity? _initialModel(List<MachineModelEntity> models) {
    final MachineEntity? existing = this.existing;
    if (existing == null) {
      return null;
    }

    for (final MachineModelEntity model in models) {
      if (model.id == existing.model.id) {
        return model;
      }
    }

    // Catalogue can lag (or omit an inactive row) — still show what the unit
    // already has so the field is editable rather than blank.
    return _syntheticFromExisting(existing);
  }

  /// Intake sees every model; edit only sees peers of the unit's type.
  List<MachineModelEntity> _modelsForForm(List<MachineModelEntity> catalogue) {
    final MachineEntity? existing = this.existing;
    if (existing == null) {
      return catalogue;
    }

    final List<MachineModelEntity> sameType = catalogue
        .where(
          (MachineModelEntity model) => model.type.id == existing.type.id,
        )
        .toList();

    final bool hasCurrent = sameType.any(
      (MachineModelEntity model) => model.id == existing.model.id,
    );

    if (hasCurrent) {
      return sameType;
    }

    return <MachineModelEntity>[
      _syntheticFromExisting(existing),
      ...sameType,
    ];
  }

  MachineModelEntity _syntheticFromExisting(MachineEntity machine) {
    return MachineModelEntity(
      id: machine.model.id,
      code: machine.model.id,
      name: machine.model.name,
      manufacturer: machine.model.manufacturer,
      type: MachineTypeEntity(
        id: machine.type.id,
        code: machine.type.id,
        name: machine.type.name,
        requiresSim: machine.type.requiresSim,
      ),
    );
  }
}
