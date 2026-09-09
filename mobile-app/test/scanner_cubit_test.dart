import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_lookup_result.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';
import 'package:machinery/feature/scanning/data/logic/scanner/scanner_cubit.dart';
import 'package:machinery/feature/scanning/data/logic/scanner/scanner_state.dart';

const MachineEntity _machine = MachineEntity(
  id: 'm1',
  serial: 'SN-1',
  status: MachineStatus.inCompanyWarehouse,
  hasBox: true,
  type: MachineTypeRef(id: 't1', name: 'Type', requiresSim: false),
  model: MachineModelRef(id: 'mo1', name: 'Model'),
  warranty: MachineWarranty(),
);

const MachineLookupResult _lookup = MachineLookupResult(
  matchedOn: ScannedSerialKind.machine,
  machine: _machine,
);

/// This is the piece "ignore duplicate scans" (`8.2`) actually lives in: the
/// camera fires a detection event many times a second while a sticker is in
/// frame, and this cubit — not the widget — is what decides one scan from a
/// dozen. None of that depends on a camera, so it is fully unit-testable.
class _FakeMachinesRepo implements MachinesRepo {
  Either<ServerFailure, MachineLookupResult>? result;
  int lookupCalls = 0;
  String? lastCodeLookedUp;

  @override
  Future<Either<ServerFailure, MachineLookupResult>> lookup({
    required String code,
  }) async {
    lookupCalls++;
    lastCodeLookedUp = code;
    return result ?? Left(ServerFailure(''));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

void main() {
  late _FakeMachinesRepo repo;
  late ScannerCubit cubit;

  setUp(() {
    repo = _FakeMachinesRepo()..result = const Right(_lookup);
    cubit = ScannerCubit(machinesRepo: repo);
  });

  tearDown(() => cubit.close());

  test('a successful lookup emits ScannerResolved with the machine', () async {
    await cubit.resolve('SN-1');

    expect(cubit.state, isA<ScannerResolved>());
    expect((cubit.state as ScannerResolved).result, _lookup);
    expect(repo.lastCodeLookedUp, 'SN-1');
  });

  test(
    'a 404 emits ScannerNotFound rather than the generic failure state',
    () async {
      repo.result = Left(ServerFailure('not found', statusCode: 404));

      await cubit.resolve('SN-404');

      expect(cubit.state, isA<ScannerNotFound>());
    },
  );

  test(
    'a non-404 failure emits ScannerFailure with the offline flag set correctly',
    () async {
      repo.result = Left(OfflineFailure());

      await cubit.resolve('SN-1');

      final ScannerFailure state = cubit.state as ScannerFailure;
      expect(state.isOffline, isTrue);
    },
  );

  test(
    'onCodeDetected ignores a repeat of the same code once resolved',
    () async {
      await cubit.onCodeDetected('SN-1');
      expect(repo.lookupCalls, 1);

      // The camera keeps firing detections of the same sticker; none of them
      // should trigger a second lookup.
      await cubit.onCodeDetected('SN-1');
      await cubit.onCodeDetected('SN-1');

      expect(repo.lookupCalls, 1);
    },
  );

  test(
    'onCodeDetected ignores everything while a lookup is already resolving',
    () async {
      // `resolve()` emits ScannerResolving synchronously before it ever awaits
      // the repo call, so `isBusy` is already true the instant this line
      // returns control — which is exactly the window a second, unawaited
      // `onCodeDetected` call (as the camera's own detection stream would fire
      // it) needs to be dropped rather than queued.
      final Future<void> firstLookup = cubit.onCodeDetected('SN-slow');

      await cubit.onCodeDetected('SN-different');

      expect(
        repo.lookupCalls,
        1,
        reason: 'the second code must be dropped while busy',
      );
      await firstLookup;
    },
  );

  test(
    'retry() clears the last code so the same sticker can be scanned again',
    () async {
      await cubit.onCodeDetected('SN-1');
      expect(repo.lookupCalls, 1);

      cubit.retry();
      expect(cubit.state, isA<ScannerScanning>());

      await cubit.onCodeDetected('SN-1');
      expect(
        repo.lookupCalls,
        2,
        reason: 'retry() forgets the last code deliberately',
      );
    },
  );

  test('an empty or blank code is never looked up', () async {
    await cubit.onCodeDetected('');
    await cubit.onCodeDetected('   ');

    expect(repo.lookupCalls, 0);
  });
}
