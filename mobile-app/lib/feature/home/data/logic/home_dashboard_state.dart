import 'package:equatable/equatable.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/home/domain/entities/home_block.dart';
import 'package:machinery/feature/home/domain/entities/home_summaries.dart';

sealed class HomeDashboardState extends Equatable {
  const HomeDashboardState();

  @override
  List<Object?> get props => <Object?>[];
}

/// Before the first load — the dashboard has never been asked for data yet.
class HomeDashboardInitial extends HomeDashboardState {
  const HomeDashboardInitial();
}

/// Each field is `null` when the caller lacks the permission that block needs
/// — the UI reads a `null` field as "do not render this card", never as a
/// failure. A non-null field is always a resolved [HomeBlock], so a slow tile
/// shows its own loading state instead of blocking the rest of the screen.
class HomeDashboardLoaded extends HomeDashboardState {
  const HomeDashboardLoaded({
    this.machines,
    this.transfers,
    this.merchants,
    this.violations,
    this.maintenance,
    this.finance,
    this.budgets,
    this.isRefreshing = false,
  });

  final HomeBlock<MachinesSummary>? machines;
  final HomeBlock<TransfersSummary>? transfers;
  final HomeBlock<MerchantsSummary>? merchants;
  final HomeBlock<ViolationsSummary>? violations;
  final HomeBlock<MaintenanceSummary>? maintenance;
  final HomeBlock<FinanceSummary>? finance;
  final HomeBlock<BudgetStatusList>? budgets;

  /// True while a pull-to-refresh (or a single-tile retry) is in flight —
  /// the previous values stay on screen underneath the refresh indicator
  /// rather than being replaced by a full-screen loader.
  final bool isRefreshing;

  HomeDashboardLoaded copyWith({
    HomeBlock<MachinesSummary>? machines,
    HomeBlock<TransfersSummary>? transfers,
    HomeBlock<MerchantsSummary>? merchants,
    HomeBlock<ViolationsSummary>? violations,
    HomeBlock<MaintenanceSummary>? maintenance,
    HomeBlock<FinanceSummary>? finance,
    HomeBlock<BudgetStatusList>? budgets,
    bool? isRefreshing,
  }) {
    return HomeDashboardLoaded(
      machines: machines ?? this.machines,
      transfers: transfers ?? this.transfers,
      merchants: merchants ?? this.merchants,
      violations: violations ?? this.violations,
      maintenance: maintenance ?? this.maintenance,
      finance: finance ?? this.finance,
      budgets: budgets ?? this.budgets,
      isRefreshing: isRefreshing ?? this.isRefreshing,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    machines,
    transfers,
    merchants,
    violations,
    maintenance,
    finance,
    budgets,
    isRefreshing,
  ];
}
