import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/machines/data/logic/machine_bulk_import/machine_bulk_import_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_bulk_import/machine_bulk_import_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/params/machine_form_params.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';

const MachineTypeEntity _pinPadType = MachineTypeEntity(
  id: 't1',
  code: 'PIN_PAD',
  name: 'Pin pad',
  requiresSim: false,
);

const MachineTypeEntity _mobilePosType = MachineTypeEntity(
  id: 't2',
  code: 'MOBILE_POS',
  name: 'Mobile POS',
  requiresSim: true,
);

const MachineModelEntity _pinPadModel = MachineModelEntity(
  id: 'model-1',
  code: 'M1',
  name: 'Pin pad model',
  type: _pinPadType,
);

const MachineModelEntity _simModel = MachineModelEntity(
  id: 'model-2',
  code: 'M2',
  name: 'SIM model',
  type: _mobilePosType,
);

class _FakeMachinesRepo implements MachinesRepo {
  Either<ServerFailure, List<MachineModelEntity>>? modelsResult;
  Either<ServerFailure, List<MachineEntity>>? bulkResult;
  List<CreateMachineParams>? lastRows;

  @override
  Future<Either<ServerFailure, List<MachineModelEntity>>> fetchMachineModels({
    bool includeInactive = false,
    bool rawTranslations = false,
  }) async {
    return modelsResult ?? const Right(<MachineModelEntity>[]);
  }

  @override
  Future<Either<ServerFailure, List<MachineEntity>>> bulkCreateMachines({
    required List<CreateMachineParams> rows,
  }) async {
    lastRows = rows;
    return bulkResult ?? const Right(<MachineEntity>[]);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

void main() {
  late _FakeMachinesRepo repo;

  setUp(() {
    repo = _FakeMachinesRepo()
      ..modelsResult = const Right(<MachineModelEntity>[
        _pinPadModel,
        _simModel,
      ]);
  });

  test(
    'load() starts with one empty row and the first model selected',
    () async {
      final MachineBulkImportCubit cubit = MachineBulkImportCubit(
        machinesRepo: repo,
      );

      await cubit.load();

      final MachineBulkImportReady state =
          cubit.state as MachineBulkImportReady;
      expect(state.rows, hasLength(1));
      expect(state.selectedModel, _pinPadModel);
      expect(state.requiresSim, isFalse);

      await cubit.close();
    },
  );

  test('addRow/removeRow manage the batch, but never below one row', () async {
    final MachineBulkImportCubit cubit = MachineBulkImportCubit(
      machinesRepo: repo,
    );
    await cubit.load();

    cubit.addRow();
    cubit.addRow();
    expect((cubit.state as MachineBulkImportReady).rows, hasLength(3));

    final String firstKey =
        (cubit.state as MachineBulkImportReady).rows.first.key;
    cubit.removeRow(firstKey);
    cubit.removeRow(firstKey); // Removing an already-gone key is a no-op.
    expect((cubit.state as MachineBulkImportReady).rows, hasLength(2));

    final List<String> remainingKeys = (cubit.state as MachineBulkImportReady)
        .rows
        .map((MachineImportRow r) => r.key)
        .toList(growable: false);
    for (final String key in remainingKeys) {
      cubit.removeRow(key);
    }
    expect((cubit.state as MachineBulkImportReady).rows, hasLength(1));

    await cubit.close();
  });

  test('switching to a SIM-requiring model updates requiresSim', () async {
    final MachineBulkImportCubit cubit = MachineBulkImportCubit(
      machinesRepo: repo,
    );
    await cubit.load();

    cubit.selectModel(_simModel);

    expect((cubit.state as MachineBulkImportReady).requiresSim, isTrue);

    await cubit.close();
  });

  test(
    'submit() sends one CreateMachineParams per row sharing the batch fields',
    () async {
      final MachineBulkImportCubit cubit = MachineBulkImportCubit(
        machinesRepo: repo,
      );
      await cubit.load();

      cubit.setFactoryInvoiceNo('INV-1');
      cubit.updateRow(
        (cubit.state as MachineBulkImportReady).rows.first.key,
        serial: 'SN-1',
        batterySerial: 'BT-1',
      );
      cubit.addRow();
      cubit.updateRow(
        (cubit.state as MachineBulkImportReady).rows.last.key,
        serial: 'SN-2',
        batterySerial: 'BT-2',
      );

      await cubit.submit();

      expect(cubit.state, isA<MachineBulkImportSubmitted>());
      expect(repo.lastRows, hasLength(2));
      expect(
        repo.lastRows!.every(
          (CreateMachineParams p) => p.machineModelId == 'model-1',
        ),
        isTrue,
      );
      expect(
        repo.lastRows!.every(
          (CreateMachineParams p) => p.factoryInvoiceNo == 'INV-1',
        ),
        isTrue,
      );
      expect(repo.lastRows![0].serial, 'SN-1');
      expect(repo.lastRows![1].serial, 'SN-2');

      await cubit.close();
    },
  );

  test(
    'a validation failure maps machines[N].field lines back onto the right row',
    () async {
      repo.bulkResult = Left(
        BulkImportValidationFailure(
          'Validation failed',
          statusCode: 400,
          problems: <String>[
            'machines[0].serial: must be longer than or equal to 3 characters',
            'machines[1].battery.serial: must be longer than or equal to 3 characters',
            'DUPLICATE_SERIAL_WITHIN_BATCH',
          ],
        ),
      );

      final MachineBulkImportCubit cubit = MachineBulkImportCubit(
        machinesRepo: repo,
      );
      await cubit.load();
      cubit.addRow();

      await cubit.submit();

      final MachineBulkImportReady state =
          cubit.state as MachineBulkImportReady;
      expect(state.isSubmitting, isFalse);
      expect(
        state.rowErrors[0]?['serial'],
        'must be longer than or equal to 3 characters',
      );
      expect(
        state.rowErrors[1]?['battery.serial'],
        'must be longer than or equal to 3 characters',
      );
      // The one line that did not match `machines[N].field` is not dropped.
      expect(state.generalError, contains('DUPLICATE_SERIAL_WITHIN_BATCH'));

      await cubit.close();
    },
  );

  test(
    'a non-validation failure surfaces as a general error and clears isSubmitting',
    () async {
      repo.bulkResult = Left(ServerFailure('server exploded', statusCode: 500));

      final MachineBulkImportCubit cubit = MachineBulkImportCubit(
        machinesRepo: repo,
      );
      await cubit.load();

      await cubit.submit();

      final MachineBulkImportReady state =
          cubit.state as MachineBulkImportReady;
      expect(state.isSubmitting, isFalse);
      expect(state.generalError, 'server exploded');
      expect(state.rowErrors, isEmpty);

      await cubit.close();
    },
  );
}
