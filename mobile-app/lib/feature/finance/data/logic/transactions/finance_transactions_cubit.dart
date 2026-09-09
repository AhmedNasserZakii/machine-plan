import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/feature/finance/data/logic/transactions/finance_transactions_state.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';

class FinanceTransactionsCubit extends Cubit<FinanceTransactionsState> {
  FinanceTransactionsCubit({required this.repo})
    : super(const FinanceTransactionsInitial());
  final FinanceRepo repo;
  Future<void> load({TransactionQuery? query, bool showLoader = true}) async {
    final TransactionQuery selected =
        (query ??
                (state is FinanceTransactionsLoaded
                    ? (state as FinanceTransactionsLoaded).query
                    : const TransactionQuery()))
            .copyWith(page: 1);
    if (showLoader) emit(const FinanceTransactionsLoading());
    final result = await repo.transactions(selected);
    if (isClosed) return;
    result.fold(
      (f) => emit(FinanceTransactionsFailure(f.errorMessage)),
      (page) => emit(
        FinanceTransactionsLoaded(
          items: page.items,
          query: selected,
          hasNext: page.meta.hasNext,
        ),
      ),
    );
  }

  Future<void> loadMore() async {
    final current = state;
    if (current is! FinanceTransactionsLoaded ||
        current.isLoadingMore ||
        !current.hasNext) {
      return;
    }
    emit(current.copyWith(isLoadingMore: true));
    final next = current.query.copyWith(page: current.query.page + 1);
    final result = await repo.transactions(next);
    if (isClosed) return;
    result.fold(
      (_) => emit(current.copyWith(isLoadingMore: false)),
      (page) => emit(
        current.copyWith(
          items: <FinanceTransaction>[...current.items, ...page.items],
          query: next,
          hasNext: page.meta.hasNext,
          isLoadingMore: false,
        ),
      ),
    );
  }

  void replace(FinanceTransaction row) {
    final current = state;
    if (current is FinanceTransactionsLoaded) {
      emit(
        current.copyWith(
          items: current.items
              .map((e) => e.id == row.id ? row : e)
              .toList(growable: false),
        ),
      );
    }
  }

  void prepend(FinanceTransaction row) {
    final current = state;
    if (current is FinanceTransactionsLoaded) {
      emit(
        current.copyWith(items: <FinanceTransaction>[row, ...current.items]),
      );
    }
  }
}
