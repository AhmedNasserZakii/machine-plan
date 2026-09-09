import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/home/data/logic/home_block_kind.dart';
import 'package:machinery/feature/home/data/logic/home_dashboard_state.dart';
import 'package:machinery/feature/home/domain/entities/home_block.dart';
import 'package:machinery/feature/home/domain/entities/home_summaries.dart';
import 'package:machinery/feature/home/domain/repos/home_repo.dart';

/// Every permitted tile is fetched concurrently and independently: one slow
/// or failing module (or the two, violations/maintenance, that simply have no
/// offline story yet) never keeps the rest of the dashboard from rendering.
/// A field the caller lacks the permission for is left `null` for the whole
/// lifetime of the cubit — permissions changing mid-session already rebuild
/// the bottom bar (`PermissionService.permissions`), and the dashboard is
/// rebuilt along with it because the tab it lives on is rebuilt too.
class HomeDashboardCubit extends Cubit<HomeDashboardState> {
  HomeDashboardCubit({required this.repo, required this.permissionService})
    : super(const HomeDashboardInitial());

  final HomeRepo repo;
  final PermissionService permissionService;

  Future<void> load() async {
    final HomeDashboardLoaded? previous = state is HomeDashboardLoaded
        ? state as HomeDashboardLoaded
        : null;

    emit(
      HomeDashboardLoaded(
        machines: _permitted(P.machinesRead) ? const HomeBlock.loading() : null,
        transfers: _permitted(P.transfersRead) ? const HomeBlock.loading() : null,
        merchants: _permitted(P.merchantsRead) ? const HomeBlock.loading() : null,
        violations: _permitted(P.violationsRead) ? const HomeBlock.loading() : null,
        maintenance: _permitted(P.maintenanceRead) ? const HomeBlock.loading() : null,
        finance: _permitted(P.financeRead) ? const HomeBlock.loading() : null,
        budgets: _permitted(P.financeRead) ? const HomeBlock.loading() : null,
        isRefreshing: previous != null,
      ),
    );

    final (
      HomeBlock<MachinesSummary>? machines,
      HomeBlock<TransfersSummary>? transfers,
      HomeBlock<MerchantsSummary>? merchants,
      HomeBlock<ViolationsSummary>? violations,
      HomeBlock<MaintenanceSummary>? maintenance,
      HomeBlock<FinanceSummary>? finance,
      HomeBlock<BudgetStatusList>? budgets,
    ) = await (
      _permitted(P.machinesRead) ? repo.machinesSummary() : Future.value(null),
      _permitted(P.transfersRead) ? repo.transfersSummary() : Future.value(null),
      _permitted(P.merchantsRead) ? repo.merchantsSummary() : Future.value(null),
      _permitted(P.violationsRead) ? repo.violationsSummary() : Future.value(null),
      _permitted(P.maintenanceRead) ? repo.maintenanceSummary() : Future.value(null),
      _permitted(P.financeRead) ? repo.financeSummary() : Future.value(null),
      _permitted(P.financeRead) ? repo.budgetsSummary() : Future.value(null),
    ).wait;

    if (isClosed) return;

    emit(
      HomeDashboardLoaded(
        machines: machines,
        transfers: transfers,
        merchants: merchants,
        violations: violations,
        maintenance: maintenance,
        finance: finance,
        budgets: budgets,
      ),
    );
  }

  /// Re-fetches one tile in place — the tap target for a tile that came back
  /// `offline`/`error`, so clearing it never costs the six tiles that already
  /// loaded fine.
  Future<void> retry(HomeBlockKind kind) async {
    if (state is! HomeDashboardLoaded) return;

    switch (kind) {
      case HomeBlockKind.machines:
        _setLoading((s) => s.copyWith(machines: const HomeBlock.loading()));
        final result = await repo.machinesSummary();
        _applyIfLoaded((s) => s.copyWith(machines: result));
      case HomeBlockKind.transfers:
        _setLoading((s) => s.copyWith(transfers: const HomeBlock.loading()));
        final result = await repo.transfersSummary();
        _applyIfLoaded((s) => s.copyWith(transfers: result));
      case HomeBlockKind.merchants:
        _setLoading((s) => s.copyWith(merchants: const HomeBlock.loading()));
        final result = await repo.merchantsSummary();
        _applyIfLoaded((s) => s.copyWith(merchants: result));
      case HomeBlockKind.violations:
        _setLoading((s) => s.copyWith(violations: const HomeBlock.loading()));
        final result = await repo.violationsSummary();
        _applyIfLoaded((s) => s.copyWith(violations: result));
      case HomeBlockKind.maintenance:
        _setLoading((s) => s.copyWith(maintenance: const HomeBlock.loading()));
        final result = await repo.maintenanceSummary();
        _applyIfLoaded((s) => s.copyWith(maintenance: result));
      case HomeBlockKind.finance:
        _setLoading((s) => s.copyWith(finance: const HomeBlock.loading()));
        final result = await repo.financeSummary();
        _applyIfLoaded((s) => s.copyWith(finance: result));
      case HomeBlockKind.budgets:
        _setLoading((s) => s.copyWith(budgets: const HomeBlock.loading()));
        final result = await repo.budgetsSummary();
        _applyIfLoaded((s) => s.copyWith(budgets: result));
    }
  }

  bool _permitted(String permission) => permissionService.has(permission);

  void _setLoading(HomeDashboardLoaded Function(HomeDashboardLoaded) update) {
    final HomeDashboardLoaded? current = state is HomeDashboardLoaded
        ? state as HomeDashboardLoaded
        : null;
    if (current == null) return;
    emit(update(current));
  }

  void _applyIfLoaded(HomeDashboardLoaded Function(HomeDashboardLoaded) update) {
    if (isClosed) return;
    final HomeDashboardLoaded? current = state is HomeDashboardLoaded
        ? state as HomeDashboardLoaded
        : null;
    if (current == null) return;
    emit(update(current));
  }
}
