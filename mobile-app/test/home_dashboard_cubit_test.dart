import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/services/finance_change_notifier.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/home/data/logic/home_block_kind.dart';
import 'package:machinery/feature/home/data/logic/home_dashboard_cubit.dart';
import 'package:machinery/feature/home/data/logic/home_dashboard_state.dart';
import 'package:machinery/feature/home/domain/entities/home_block.dart';
import 'package:machinery/feature/home/domain/entities/home_summaries.dart';
import 'package:machinery/feature/home/domain/repos/home_repo.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The dashboard is entirely permission-driven — no role name ever appears in
/// [HomeDashboardCubit] — so these tests approximate "Director" and
/// "representative" the same way production does: by the permission set
/// each one actually carries, not by a role label.
const List<String> _directorPermissions = <String>[
  P.machinesRead,
  P.transfersRead,
  P.merchantsRead,
  P.violationsRead,
  P.maintenanceRead,
  P.financeRead,
];

const List<String> _representativePermissions = <String>[
  P.machinesRead,
  P.transfersRead,
];

class _FakeHomeRepo implements HomeRepo {
  int machinesCalls = 0;
  int transfersCalls = 0;
  int merchantsCalls = 0;
  int violationsCalls = 0;
  int maintenanceCalls = 0;
  int financeCalls = 0;
  int budgetsCalls = 0;

  HomeBlock<MachinesSummary> machinesResult =
      const HomeBlock<MachinesSummary>.ready(MachinesSummary(total: 1));
  HomeBlock<TransfersSummary> transfersResult =
      const HomeBlock<TransfersSummary>.ready(
        TransfersSummary(pendingForMe: 2),
      );
  HomeBlock<MerchantsSummary> merchantsResult =
      const HomeBlock<MerchantsSummary>.ready(MerchantsSummary(total: 3));
  HomeBlock<ViolationsSummary> violationsResult =
      const HomeBlock<ViolationsSummary>.ready(ViolationsSummary(open: 4));
  HomeBlock<MaintenanceSummary> maintenanceResult =
      const HomeBlock<MaintenanceSummary>.ready(MaintenanceSummary(open: 5));
  HomeBlock<FinanceSummary> financeResult = HomeBlock<FinanceSummary>.ready(
    FinanceSummary(
      period: FinancePeriod(
        from: DateTime(2026, 1, 1),
        to: DateTime(2026, 1, 31),
      ),
      income: 100,
      expense: 40,
      net: 60,
      incomeCount: 1,
      expenseCount: 1,
    ),
  );
  HomeBlock<BudgetStatusList> budgetsResult = HomeBlock<BudgetStatusList>.ready(
    BudgetStatusList(
      asOf: DateTime(2026),
      budgets: const <FinanceBudgetStatus>[],
    ),
  );

  @override
  Future<HomeBlock<MachinesSummary>> machinesSummary() async {
    machinesCalls++;
    return machinesResult;
  }

  @override
  Future<HomeBlock<TransfersSummary>> transfersSummary() async {
    transfersCalls++;
    return transfersResult;
  }

  @override
  Future<HomeBlock<MerchantsSummary>> merchantsSummary() async {
    merchantsCalls++;
    return merchantsResult;
  }

  @override
  Future<HomeBlock<ViolationsSummary>> violationsSummary() async {
    violationsCalls++;
    return violationsResult;
  }

  @override
  Future<HomeBlock<MaintenanceSummary>> maintenanceSummary() async {
    maintenanceCalls++;
    return maintenanceResult;
  }

  @override
  Future<HomeBlock<FinanceSummary>> financeSummary() async {
    financeCalls++;
    return financeResult;
  }

  @override
  Future<HomeBlock<BudgetStatusList>> budgetsSummary() async {
    budgetsCalls++;
    return budgetsResult;
  }
}

Future<PermissionService> _permissionService(List<String> permissions) async {
  SharedPreferences.setMockInitialValues(<String, Object>{});
  LocalStorage.local = await SharedPreferences.getInstance();
  final PermissionService service = PermissionService();
  await service.update(permissions);
  return service;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('permission-driven block visibility', () {
    test(
      'a Director-like permission set fetches and renders every block',
      () async {
        final _FakeHomeRepo repo = _FakeHomeRepo();
        final HomeDashboardCubit cubit = HomeDashboardCubit(
          repo: repo,
          permissionService: await _permissionService(_directorPermissions),
          financeChangeNotifier: FinanceChangeNotifier(),
        );

        await cubit.load();
        final HomeDashboardLoaded state = cubit.state as HomeDashboardLoaded;

        expect(state.machines?.isReady, isTrue);
        expect(state.transfers?.isReady, isTrue);
        expect(state.merchants?.isReady, isTrue);
        expect(state.violations?.isReady, isTrue);
        expect(state.maintenance?.isReady, isTrue);
        expect(state.finance?.isReady, isTrue);
        // Budgets rides on `financeRead`, same as the finance tab's own budget
        // alerts card — there is no separate "budgets.read" permission.
        expect(state.budgets?.isReady, isTrue);

        await cubit.close();
      },
    );

    test(
      'a representative with only machines/transfers read sees only those two',
      () async {
        final _FakeHomeRepo repo = _FakeHomeRepo();
        final HomeDashboardCubit cubit = HomeDashboardCubit(
          repo: repo,
          permissionService: await _permissionService(
            _representativePermissions,
          ),
          financeChangeNotifier: FinanceChangeNotifier(),
        );

        await cubit.load();
        final HomeDashboardLoaded state = cubit.state as HomeDashboardLoaded;

        expect(state.machines, isNotNull);
        expect(state.transfers, isNotNull);
        expect(state.merchants, isNull);
        expect(state.violations, isNull);
        expect(state.maintenance, isNull);
        expect(state.finance, isNull);
        expect(state.budgets, isNull);

        // The repo is never even called for a block the caller cannot see —
        // permission gating happens before the network call, not after.
        expect(repo.merchantsCalls, 0);
        expect(repo.violationsCalls, 0);
        expect(repo.maintenanceCalls, 0);
        expect(repo.financeCalls, 0);
        expect(repo.budgetsCalls, 0);

        await cubit.close();
      },
    );

    test(
      'a role with no read permissions at all loads to an all-null, crash-free state',
      () async {
        final _FakeHomeRepo repo = _FakeHomeRepo();
        final HomeDashboardCubit cubit = HomeDashboardCubit(
          repo: repo,
          permissionService: await _permissionService(const <String>[]),
          financeChangeNotifier: FinanceChangeNotifier(),
        );

        await cubit.load();
        final HomeDashboardLoaded state = cubit.state as HomeDashboardLoaded;

        expect(state.machines, isNull);
        expect(state.transfers, isNull);
        expect(state.merchants, isNull);
        expect(state.violations, isNull);
        expect(state.maintenance, isNull);
        expect(state.finance, isNull);
        expect(state.budgets, isNull);

        await cubit.close();
      },
    );
  });

  group('partial-failure handling', () {
    test('one block failing offline never affects the others', () async {
      final _FakeHomeRepo repo = _FakeHomeRepo()
        ..financeResult = const HomeBlock<FinanceSummary>.offline();
      final HomeDashboardCubit cubit = HomeDashboardCubit(
        repo: repo,
        permissionService: await _permissionService(_directorPermissions),
        financeChangeNotifier: FinanceChangeNotifier(),
      );

      await cubit.load();
      final HomeDashboardLoaded state = cubit.state as HomeDashboardLoaded;

      expect(state.finance?.availability, HomeBlockAvailability.offline);
      expect(state.machines?.isReady, isTrue);
      expect(state.transfers?.isReady, isTrue);
      expect(state.merchants?.isReady, isTrue);
      expect(state.violations?.isReady, isTrue);
      expect(state.maintenance?.isReady, isTrue);

      await cubit.close();
    });

    test(
      'retrying one block only re-fetches that block and leaves the rest untouched',
      () async {
        final _FakeHomeRepo repo = _FakeHomeRepo()
          ..violationsResult = const HomeBlock<ViolationsSummary>.error('boom');
        final HomeDashboardCubit cubit = HomeDashboardCubit(
          repo: repo,
          permissionService: await _permissionService(_directorPermissions),
          financeChangeNotifier: FinanceChangeNotifier(),
        );

        await cubit.load();
        final HomeBlock<MachinesSummary>? machinesBeforeRetry =
            (cubit.state as HomeDashboardLoaded).machines;
        expect(
          (cubit.state as HomeDashboardLoaded).violations?.availability,
          HomeBlockAvailability.error,
        );

        repo.violationsResult = const HomeBlock<ViolationsSummary>.ready(
          ViolationsSummary(open: 0),
        );
        await cubit.retry(HomeBlockKind.violations);
        final HomeDashboardLoaded afterRetry =
            cubit.state as HomeDashboardLoaded;

        expect(afterRetry.violations?.isReady, isTrue);
        expect(afterRetry.violations?.data?.open, 0);
        // Machines was never asked again — the retry is scoped to one tile.
        expect(repo.machinesCalls, 1);
        expect(identical(afterRetry.machines, machinesBeforeRetry), isTrue);

        await cubit.close();
      },
    );
  });
}
