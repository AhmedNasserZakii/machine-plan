import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/machines/data/logic/machine_maintenance_history/machine_maintenance_history_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_maintenance_history/machine_maintenance_history_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_maintenance_history.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';

const MachineMaintenanceHistory _history = MachineMaintenanceHistory(
  machineId: 'm1',
  serial: 'SN-1',
  totals: MaintenanceHistoryTotals(orders: 1, totalCost: 100),
  orders: <MaintenanceOrderSummary>[],
);

class _FakeMachinesRepo implements MachinesRepo {
  Either<ServerFailure, MachineMaintenanceHistory>? result;
  int calls = 0;
  String? lastMachineId;

  @override
  Future<Either<ServerFailure, MachineMaintenanceHistory>>
  fetchMaintenanceHistory({required String machineId}) async {
    calls++;
    lastMachineId = machineId;
    return result ?? Left(ServerFailure(''));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

void main() {
  test('load() surfaces the history on success', () async {
    final _FakeMachinesRepo repo = _FakeMachinesRepo()
      ..result = const Right(_history);

    final MachineMaintenanceHistoryCubit cubit = MachineMaintenanceHistoryCubit(
      machinesRepo: repo,
      machineId: 'm1',
    );

    await cubit.load();

    expect(cubit.state, isA<MachineMaintenanceHistoryLoaded>());
    expect((cubit.state as MachineMaintenanceHistoryLoaded).history, _history);
    expect(repo.lastMachineId, 'm1');

    await cubit.close();
  });

  test(
    'a permission-denied response surfaces as a failure, not a crash',
    () async {
      final _FakeMachinesRepo repo = _FakeMachinesRepo()
        ..result = Left(ServerFailure('forbidden', statusCode: 403));

      final MachineMaintenanceHistoryCubit cubit =
          MachineMaintenanceHistoryCubit(machinesRepo: repo, machineId: 'm1');

      await cubit.load();

      final MachineMaintenanceHistoryFailure state =
          cubit.state as MachineMaintenanceHistoryFailure;
      expect(state.errorMessage, 'forbidden');
      expect(state.isOffline, isFalse);

      await cubit.close();
    },
  );

  test('offline surfaces the offline flag', () async {
    final _FakeMachinesRepo repo = _FakeMachinesRepo()
      ..result = Left(OfflineFailure());

    final MachineMaintenanceHistoryCubit cubit = MachineMaintenanceHistoryCubit(
      machinesRepo: repo,
      machineId: 'm1',
    );

    await cubit.load();

    expect((cubit.state as MachineMaintenanceHistoryFailure).isOffline, isTrue);

    await cubit.close();
  });
}
