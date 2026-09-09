import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/merchants/data/logic/merchants_list/merchants_list_state.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/domain/params/merchants_query_params.dart';
import 'package:machinery/feature/merchants/domain/repos/merchants_repo.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

class MerchantsListCubit extends Cubit<MerchantsListState> {
  MerchantsListCubit({required this.merchantsRepo})
    : super(const MerchantsListInitial());

  final MerchantsRepo merchantsRepo;

  /// Typing in the search box must not fire a request per keystroke.
  static const Duration searchDebounce = Duration(milliseconds: 350);

  Timer? _searchTimer;

  List<BranchEntity> _branches = const <BranchEntity>[];

  @override
  Future<void> close() {
    _searchTimer?.cancel();
    return super.close();
  }

  /// First load and the pull-to-refresh path. Keeps whatever filters are
  /// already applied unless [params] overrides them.
  Future<void> load({
    MerchantsQueryParams? params,
    bool showLoader = true,
  }) async {
    if (isClosed) {
      return;
    }

    final MerchantsQueryParams query = (params ?? _currentQuery).copyWith(
      page: 1,
    );

    if (showLoader) {
      emit(const MerchantsListLoading());
    }

    await _ensureBranches();

    final result = await merchantsRepo.fetchMerchants(params: query);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        MerchantsListFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (MerchantsPage page) => emit(
        MerchantsListLoaded(
          merchants: page.merchants,
          query: query,
          hasNext: page.meta.hasNext,
          total: page.meta.total,
          branches: _branches,
        ),
      ),
    );
  }

  Future<void> loadMore() async {
    final MerchantsListState current = state;

    if (current is! MerchantsListLoaded ||
        current.isLoadingMore ||
        !current.hasNext) {
      return;
    }

    emit(current.copyWith(isLoadingMore: true));

    final MerchantsQueryParams next = current.query.copyWith(
      page: current.query.page + 1,
    );

    final result = await merchantsRepo.fetchMerchants(params: next);

    if (isClosed) {
      return;
    }

    result.fold(
      // A failed page must not wipe the pages already on screen.
      (ServerFailure _) => emit(current.copyWith(isLoadingMore: false)),
      (MerchantsPage page) => emit(
        current.copyWith(
          merchants: <MerchantEntity>[...current.merchants, ...page.merchants],
          query: next,
          hasNext: page.meta.hasNext,
          total: page.meta.total,
          isLoadingMore: false,
        ),
      ),
    );
  }

  void search(String term) {
    _searchTimer?.cancel();
    _searchTimer = Timer(searchDebounce, () {
      final String trimmed = term.trim();
      load(
        params: trimmed.isEmpty
            ? _currentQuery.copyWith(resetSearch: true)
            : _currentQuery.copyWith(search: trimmed),
        showLoader: false,
      );
    });
  }

  Future<void> applyFilters(MerchantsQueryParams filters) {
    return load(params: filters.copyWith(page: 1), showLoader: false);
  }

  Future<void> clearFilters() {
    return load(params: _currentQuery.cleared(), showLoader: false);
  }

  /// Swaps one row in place after an edit, so returning from the detail screen
  /// does not scroll the list back to the top.
  void replaceMerchant(MerchantEntity updated) {
    final MerchantsListState current = state;
    if (current is! MerchantsListLoaded) {
      return;
    }

    emit(
      current.copyWith(
        merchants: current.merchants
            .map(
              (MerchantEntity merchant) =>
                  merchant.id == updated.id ? updated : merchant,
            )
            .toList(growable: false),
      ),
    );
  }

  /// Drops a merchant the detail screen has just closed out, unless the list is
  /// showing inactive rows too — there it belongs, greyed.
  void removeMerchant(String id) {
    final MerchantsListState current = state;
    if (current is! MerchantsListLoaded || current.query.includeInactive) {
      return;
    }

    emit(
      current.copyWith(
        merchants: current.merchants
            .where((MerchantEntity merchant) => merchant.id != id)
            .toList(growable: false),
        total: current.total > 0 ? current.total - 1 : 0,
      ),
    );
  }

  MerchantsQueryParams get _currentQuery {
    final MerchantsListState current = state;
    return current is MerchantsListLoaded
        ? current.query
        : const MerchantsQueryParams();
  }

  Future<void> _ensureBranches() async {
    if (_branches.isNotEmpty) {
      return;
    }

    // Failing is not fatal: the list still renders and the filter sheet just
    // has less to offer, which is exactly what a representative sees anyway.
    final result = await merchantsRepo.fetchBranches();
    _branches = result.getOrElse(() => _branches);
  }
}
