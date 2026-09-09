import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/services/sync/finance_sync_queue.dart';
import 'package:machinery/feature/finance/data/logic/finance_overview/finance_overview_state.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';

class FinanceOverviewCubit extends Cubit<FinanceOverviewState> {
  FinanceOverviewCubit({required this.repo, required this.queue})
    : super(const FinanceOverviewInitial());
  final FinanceRepo repo;
  final FinanceSyncQueue queue;

  Future<void> load({FinanceQuery? query, bool showLoader = true}) async {
    final FinanceOverviewLoaded? previous = state is FinanceOverviewLoaded
        ? state as FinanceOverviewLoaded
        : null;
    final FinanceQuery selected =
        query ??
        (state is FinanceOverviewLoaded
            ? (state as FinanceOverviewLoaded).query
            : const FinanceQuery());
    if (showLoader) emit(const FinanceOverviewLoading());
    await repo.flushPendingTransactions();
    // These calls also refresh the durable picker cache used by offline forms.
    await (
      repo.categories(kind: FinanceKind.expense),
      repo.categories(kind: FinanceKind.income),
      repo.paymentMethods(),
      repo.suppliers(),
    ).wait;
    final results = await (
      repo.summary(selected),
      repo.budgetStatus(selected),
      repo.branches(),
    ).wait;
    if (isClosed) return;
    final failure = results.$1.fold(
      (f) => f,
      (_) => results.$2.fold(
        (f) => f,
        (_) => results.$3.fold((f) => f, (_) => null),
      ),
    );
    if (failure != null) {
      if (previous != null && !showLoader) {
        emit(
          FinanceOverviewLoaded(
            summary: previous.summary,
            budgets: previous.budgets,
            branches: previous.branches,
            query: selected,
            pendingCount: await queue.pendingCount(),
          ),
        );
        return;
      }
      emit(FinanceOverviewFailure(failure.errorMessage));
      return;
    }
    emit(
      FinanceOverviewLoaded(
        summary: results.$1.getOrElse(() => throw StateError('summary')),
        budgets: results.$2.getOrElse(() => throw StateError('budgets')),
        branches: results.$3.getOrElse(() => const <FinanceRef>[]),
        query: selected,
        pendingCount: await queue.pendingCount(),
      ),
    );
  }
}
