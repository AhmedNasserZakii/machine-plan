import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
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

MaintenanceOrderSummary _order(String id) => MaintenanceOrderSummary(
  id: id,
  referenceNo: 'MNT-$id',
  locationName: 'workshop',
  status: MaintenanceOrderStatus.open,
  sentAt: DateTime(2026, 1, 1),
  isFreeUnderWarranty: false,
);

MachineMaintenanceHistory _pagedHistory({
  required List<MaintenanceOrderSummary> orders,
  required PaginationMetaModel meta,
}) => MachineMaintenanceHistory(
  machineId: 'm1',
  serial: 'SN-1',
  totals: const MaintenanceHistoryTotals(orders: 2, totalCost: 100),
  orders: orders,
  ordersMeta: meta,
);

class _FakeMachinesRepo implements MachinesRepo {
  Either<ServerFailure, MachineMaintenanceHistory>? result;
  Either<ServerFailure, MachineMaintenanceHistory>? nextPageResult;
  int calls = 0;
  String? lastMachineId;
  int? lastPage;

  @override
  Future<Either<ServerFailure, MachineMaintenanceHistory>>
  fetchMaintenanceHistory({required String machineId, int page = 1}) async {
    calls++;
    lastMachineId = machineId;
    lastPage = page;
    if (page > 1) {
      return nextPageResult ?? Left(ServerFailure(''));
    }
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

  test('loadMore appends the next page of orders and keeps totals', () async {
    final _FakeMachinesRepo repo = _FakeMachinesRepo()
      ..result = Right(
        _pagedHistory(
          orders: <MaintenanceOrderSummary>[_order('o1')],
          meta: const PaginationMetaModel(
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 2,
            hasNext: true,
          ),
        ),
      )
      ..nextPageResult = Right(
        _pagedHistory(
          orders: <MaintenanceOrderSummary>[_order('o2')],
          meta: const PaginationMetaModel(
            page: 2,
            limit: 20,
            total: 2,
            totalPages: 2,
            hasNext: false,
          ),
        ),
      );

    final MachineMaintenanceHistoryCubit cubit = MachineMaintenanceHistoryCubit(
      machinesRepo: repo,
      machineId: 'm1',
    );

    await cubit.load();
    await cubit.loadMore();

    final MachineMaintenanceHistoryLoaded loaded =
        cubit.state as MachineMaintenanceHistoryLoaded;
    expect(loaded.history.orders.map((MaintenanceOrderSummary o) => o.id),
        <String>['o1', 'o2']);
    expect(loaded.history.totals.orders, 2);
    expect(loaded.hasNext, isFalse);
    expect(repo.lastPage, 2);
    expect(repo.calls, 2);

    await cubit.close();
  });
}
