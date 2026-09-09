import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/core/lookups/lookups_repo.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/violations/data/logic/violations_list/violations_list_state.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/params/violations_query_params.dart';
import 'package:machinery/feature/violations/domain/repos/violations_repo.dart';

class ViolationsListCubit extends Cubit<ViolationsListState> {
  ViolationsListCubit({required this.violationsRepo})
    : super(const ViolationsListInitial());

  final ViolationsRepo violationsRepo;

  List<LookupEntity> _types = const <LookupEntity>[];

  /// First load and the pull-to-refresh path. [params] is how a caller scopes
  /// the register to one machine or one representative before it ever loads.
  Future<void> load({
    ViolationsQueryParams? params,
    bool showLoader = true,
  }) async {
    if (isClosed) {
      return;
    }

    final ViolationsQueryParams query = (params ?? _currentQuery).copyWith(
      page: 1,
    );

    if (showLoader) {
      emit(const ViolationsListLoading());
    }

    await _ensureTypes();

    final result = await violationsRepo.fetchViolations(params: query);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        ViolationsListFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (ViolationsPage page) => emit(
        ViolationsListLoaded(
          violations: page.violations,
          query: query,
          hasNext: page.meta.hasNext,
          total: page.meta.total,
          types: _types,
        ),
      ),
    );
  }

  Future<void> loadMore() async {
    final ViolationsListState current = state;

    if (current is! ViolationsListLoaded ||
        current.isLoadingMore ||
        !current.hasNext) {
      return;
    }

    emit(current.copyWith(isLoadingMore: true));

    final ViolationsQueryParams next = current.query.copyWith(
      page: current.query.page + 1,
    );

    final result = await violationsRepo.fetchViolations(params: next);

    if (isClosed) {
      return;
    }

    result.fold(
      // A failed page must not wipe the pages already on screen.
      (ServerFailure _) => emit(current.copyWith(isLoadingMore: false)),
      (ViolationsPage page) => emit(
        current.copyWith(
          violations: <ViolationEntity>[
            ...current.violations,
            ...page.violations,
          ],
          query: next,
          hasNext: page.meta.hasNext,
          total: page.meta.total,
          isLoadingMore: false,
        ),
      ),
    );
  }

  Future<void> applyFilters(ViolationsQueryParams filters) {
    return load(params: filters.copyWith(page: 1), showLoader: false);
  }

  Future<void> clearFilters() {
    return load(params: _currentQuery.cleared(), showLoader: false);
  }

  /// Swaps one row in place after an action, so returning from the detail
  /// screen does not scroll the list back to the top.
  void replaceViolation(ViolationEntity updated) {
    final ViolationsListState current = state;
    if (current is! ViolationsListLoaded) {
      return;
    }

    emit(
      current.copyWith(
        violations: current.violations
            .map(
              (ViolationEntity violation) =>
                  violation.id == updated.id ? updated : violation,
            )
            .toList(growable: false),
      ),
    );
  }

  ViolationsQueryParams get _currentQuery {
    final ViolationsListState current = state;
    return current is ViolationsListLoaded
        ? current.query
        : const ViolationsQueryParams();
  }

  Future<void> _ensureTypes() async {
    if (_types.isNotEmpty) {
      return;
    }

    // Failing is not fatal: the list still renders and the filter sheet just
    // has one section fewer.
    final result = await getIt<LookupsRepo>().violationTypes();
    _types = result.getOrElse(() => _types);
  }
}
