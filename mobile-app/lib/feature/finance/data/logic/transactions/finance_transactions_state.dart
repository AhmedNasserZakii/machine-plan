import 'package:equatable/equatable.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';

sealed class FinanceTransactionsState extends Equatable {
  const FinanceTransactionsState();
  @override
  List<Object?> get props => const [];
}

class FinanceTransactionsInitial extends FinanceTransactionsState {
  const FinanceTransactionsInitial();
}

class FinanceTransactionsLoading extends FinanceTransactionsState {
  const FinanceTransactionsLoading();
}

class FinanceTransactionsFailure extends FinanceTransactionsState {
  const FinanceTransactionsFailure(this.message);
  final String message;
  @override
  List<Object?> get props => [message];
}

class FinanceTransactionsLoaded extends FinanceTransactionsState {
  const FinanceTransactionsLoaded({
    required this.items,
    required this.query,
    required this.hasNext,
    this.isLoadingMore = false,
  });
  final List<FinanceTransaction> items;
  final TransactionQuery query;
  final bool hasNext;
  final bool isLoadingMore;
  FinanceTransactionsLoaded copyWith({
    List<FinanceTransaction>? items,
    TransactionQuery? query,
    bool? hasNext,
    bool? isLoadingMore,
  }) => FinanceTransactionsLoaded(
    items: items ?? this.items,
    query: query ?? this.query,
    hasNext: hasNext ?? this.hasNext,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
  );
  @override
  List<Object?> get props => [items, query, hasNext, isLoadingMore];
}
