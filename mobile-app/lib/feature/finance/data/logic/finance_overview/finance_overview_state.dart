import 'package:equatable/equatable.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';

sealed class FinanceOverviewState extends Equatable {
  const FinanceOverviewState();
  @override
  List<Object?> get props => const <Object?>[];
}

class FinanceOverviewInitial extends FinanceOverviewState {
  const FinanceOverviewInitial();
}

class FinanceOverviewLoading extends FinanceOverviewState {
  const FinanceOverviewLoading();
}

class FinanceOverviewFailure extends FinanceOverviewState {
  const FinanceOverviewFailure(this.message);
  final String message;
  @override
  List<Object?> get props => <Object?>[message];
}

class FinanceOverviewLoaded extends FinanceOverviewState {
  const FinanceOverviewLoaded({
    required this.summary,
    required this.budgets,
    required this.query,
    required this.branches,
    required this.pendingCount,
  });
  final FinanceSummary summary;
  final BudgetStatusList budgets;
  final FinanceQuery query;
  final List<FinanceRef> branches;
  final int pendingCount;
  @override
  List<Object?> get props => <Object?>[
    summary,
    budgets,
    query,
    branches,
    pendingCount,
  ];
}
