import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/transfers/data/logic/transfers_list/transfers_list_state.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfers_query_params.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo.dart';

class TransfersListCubit extends Cubit<TransfersListState> {
  TransfersListCubit({required this.transfersRepo})
    : super(const TransfersListInitial());

  final TransfersRepo transfersRepo;

  int _incomingCount = 0;

  Future<void> load({
    TransfersQueryParams? params,
    bool showLoader = true,
  }) async {
    if (isClosed) return;

    final TransfersQueryParams query = (params ?? _currentQuery).copyWith(
      page: 1,
    );

    if (showLoader) emit(const TransfersListLoading());

    final result = await transfersRepo.fetchTransfers(params: query);

    if (isClosed) return;

    result.fold(
      (ServerFailure failure) => emit(
        TransfersListFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (TransfersPage page) {
        // The inbox tab already knows its own total; the other two have to ask.
        if (query.scope == TransfersScope.incoming) {
          _incomingCount = page.meta.total;
        }

        emit(
          TransfersListLoaded(
            transfers: page.transfers,
            query: query,
            hasNext: page.meta.hasNext,
            total: page.meta.total,
            incomingCount: _incomingCount,
          ),
        );
      },
    );

    unawaitedInboxCount(query.scope);
  }

  /// Switches tabs. Each tab is a different endpoint, so this is a reload
  /// rather than a client-side filter.
  Future<void> selectScope(TransfersScope scope) {
    if (_currentQuery.scope == scope) return Future<void>.value();

    return load(params: _currentQuery.copyWith(scope: scope, page: 1));
  }

  Future<void> loadMore() async {
    final TransfersListState current = state;

    if (current is! TransfersListLoaded ||
        current.isLoadingMore ||
        !current.hasNext) {
      return;
    }

    emit(current.copyWith(isLoadingMore: true));

    final TransfersQueryParams next = current.query.copyWith(
      page: current.query.page + 1,
    );

    final result = await transfersRepo.fetchTransfers(params: next);

    if (isClosed) return;

    result.fold(
      // A failed page must not wipe the pages already on screen.
      (ServerFailure _) => emit(current.copyWith(isLoadingMore: false)),
      (TransfersPage page) => emit(
        current.copyWith(
          transfers: <TransferEntity>[...current.transfers, ...page.transfers],
          query: next,
          hasNext: page.meta.hasNext,
          total: page.meta.total,
          isLoadingMore: false,
        ),
      ),
    );
  }

  Future<void> applyFilters(TransfersQueryParams filters) =>
      load(params: filters.copyWith(page: 1), showLoader: false);

  Future<void> clearFilters() =>
      load(params: _currentQuery.cleared(), showLoader: false);

  /// Refreshes the inbox badge without disturbing the visible list, which is
  /// what makes the count right after confirming something from another tab.
  Future<void> unawaitedInboxCount(TransfersScope currentScope) async {
    if (currentScope == TransfersScope.incoming) return;

    final result = await transfersRepo.fetchTransfers(
      params: const TransfersQueryParams(
        scope: TransfersScope.incoming,
        limit: 1,
      ),
    );

    if (isClosed) return;

    result.fold((ServerFailure _) {}, (TransfersPage page) {
      _incomingCount = page.meta.total;

      final TransfersListState current = state;
      if (current is TransfersListLoaded) {
        emit(current.copyWith(incomingCount: _incomingCount));
      }
    });
  }

  TransfersQueryParams get _currentQuery {
    final TransfersListState current = state;
    return current is TransfersListLoaded
        ? current.query
        : const TransfersQueryParams();
  }
}
