import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/machines/data/logic/machine_bulk_import/machine_bulk_import_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/params/machine_form_params.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';

/// Factory intake, many units at once (`8.1`). One shipment: one model, one
/// box/purchase/warranty story, and a serial-only row per unit — see
/// `MachineBulkImportReady`'s doc comment for why the fields split that way.
class MachineBulkImportCubit extends Cubit<MachineBulkImportState> {
  MachineBulkImportCubit({required this.machinesRepo})
    : super(const MachineBulkImportLoading());

  final MachinesRepo machinesRepo;

  static const int maxRows = 500;

  /// Matches the server's per-row field path, e.g. `machines[2].serial`.
  static final RegExp _rowFieldPattern = RegExp(r'^machines\[(\d+)\]\.(.+)$');

  int _nextRowKey = 0;

  Future<void> load() async {
    if (isClosed) {
      return;
    }

    emit(const MachineBulkImportLoading());

    final Either<ServerFailure, List<MachineModelEntity>> result =
        await machinesRepo.fetchMachineModels();

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        MachineBulkImportLoadFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (List<MachineModelEntity> models) => emit(
        MachineBulkImportReady(
          models: models,
          selectedModel: models.isEmpty ? null : models.first,
          rows: <MachineImportRow>[_newRow()],
        ),
      ),
    );
  }

  void selectModel(MachineModelEntity model) {
    final MachineBulkImportReady? current = _ready;
    if (current == null) return;

    emit(current.copyWith(selectedModel: model, clearErrors: true));
  }

  void setHasBox({required bool hasBox}) {
    final MachineBulkImportReady? current = _ready;
    if (current == null) return;

    emit(current.copyWith(hasBox: hasBox));
  }

  void setPurchasePrice(double? value) {
    _update((MachineBulkImportReady s) => s.copyWith(purchasePrice: value));
  }

  void setPurchaseDate(String? value) {
    _update((MachineBulkImportReady s) => s.copyWith(purchaseDate: value));
  }

  void setFactoryInvoiceNo(String? value) {
    _update((MachineBulkImportReady s) => s.copyWith(factoryInvoiceNo: value));
  }

  void setWarrantyStart(String? value) {
    _update((MachineBulkImportReady s) => s.copyWith(warrantyStart: value));
  }

  void setWarrantyEnd(String? value) {
    _update((MachineBulkImportReady s) => s.copyWith(warrantyEnd: value));
  }

  void setNotes(String? value) {
    _update((MachineBulkImportReady s) => s.copyWith(notes: value));
  }

  void addRow() {
    final MachineBulkImportReady? current = _ready;
    if (current == null || current.rows.length >= maxRows) return;

    emit(
      current.copyWith(rows: <MachineImportRow>[...current.rows, _newRow()]),
    );
  }

  void removeRow(String key) {
    final MachineBulkImportReady? current = _ready;
    // At least one row always stays — an empty batch is not a smaller import,
    // it is nothing to submit.
    if (current == null || current.rows.length <= 1) return;

    emit(
      current.copyWith(
        rows: current.rows
            .where((MachineImportRow row) => row.key != key)
            .toList(growable: false),
      ),
    );
  }

  void updateRow(
    String key, {
    String? serial,
    String? batterySerial,
    String? simSerial,
    String? boxSerial,
  }) {
    final MachineBulkImportReady? current = _ready;
    if (current == null) return;

    emit(
      current.copyWith(
        rows: current.rows
            .map(
              (MachineImportRow row) => row.key == key
                  ? row.copyWith(
                      serial: serial,
                      batterySerial: batterySerial,
                      simSerial: simSerial,
                      boxSerial: boxSerial,
                    )
                  : row,
            )
            .toList(growable: false),
      ),
    );
  }

  Future<void> submit() async {
    final MachineBulkImportReady? current = _ready;
    final MachineModelEntity? model = current?.selectedModel;
    if (current == null || model == null || current.isSubmitting) {
      return;
    }

    emit(current.copyWith(isSubmitting: true, clearErrors: true));

    final List<CreateMachineParams> params = current.rows
        .map(
          (MachineImportRow row) => CreateMachineParams(
            serial: row.serial,
            machineModelId: model.id,
            batterySerial: row.batterySerial,
            hasBox: current.hasBox,
            simSerial: current.requiresSim ? row.simSerial : null,
            boxSerial: current.hasBox ? row.boxSerial : null,
            purchasePrice: current.purchasePrice,
            purchaseDate: current.purchaseDate,
            factoryInvoiceNo: current.factoryInvoiceNo,
            warrantyStart: current.warrantyStart,
            warrantyEnd: current.warrantyEnd,
            notes: current.notes,
          ),
        )
        .toList(growable: false);

    final Either<ServerFailure, List<MachineEntity>> result = await machinesRepo
        .bulkCreateMachines(rows: params);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) {
        if (failure is BulkImportValidationFailure) {
          final (Map<int, Map<String, String>> rowErrors, String? general) =
              _parseProblems(failure.problems);
          emit(
            current.copyWith(
              isSubmitting: false,
              rowErrors: rowErrors,
              generalError: general ?? failure.errorMessage,
            ),
          );
          return;
        }

        emit(
          current.copyWith(
            isSubmitting: false,
            generalError: failure.errorMessage,
          ),
        );
      },
      (List<MachineEntity> created) =>
          emit(MachineBulkImportSubmitted(createdCount: created.length)),
    );
  }

  (Map<int, Map<String, String>>, String?) _parseProblems(
    List<String> problems,
  ) {
    final Map<int, Map<String, String>> rowErrors =
        <int, Map<String, String>>{};
    final List<String> unmatched = <String>[];

    for (final String line in problems) {
      final int separator = line.indexOf(': ');
      final String field = separator == -1
          ? line
          : line.substring(0, separator);
      final String constraint = separator == -1
          ? line
          : line.substring(separator + 2);

      final RegExpMatch? match = _rowFieldPattern.firstMatch(field);
      if (match == null) {
        unmatched.add(line);
        continue;
      }

      final int index = int.parse(match.group(1)!);
      final String column = match.group(2)!;
      rowErrors.putIfAbsent(index, () => <String, String>{})[column] =
          constraint;
    }

    return (rowErrors, unmatched.isEmpty ? null : unmatched.join('\n'));
  }

  MachineImportRow _newRow() => MachineImportRow(key: 'row-${_nextRowKey++}');

  MachineBulkImportReady? get _ready {
    final MachineBulkImportState current = state;
    return current is MachineBulkImportReady ? current : null;
  }

  void _update(
    MachineBulkImportReady Function(MachineBulkImportReady state) transform,
  ) {
    final MachineBulkImportReady? current = _ready;
    if (current == null) return;
    emit(transform(current));
  }
}
