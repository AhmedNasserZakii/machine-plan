import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/core/lookups/lookups_repo.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_list/maintenance_list_state.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/domain/repos/maintenance_repo.dart';

class MaintenanceListCubit extends Cubit<MaintenanceListState> {
  MaintenanceListCubit({required this.maintenanceRepo})
    : super(const MaintenanceListInitial());

  final MaintenanceRepo maintenanceRepo;

  List<LookupEntity> _locations = const <LookupEntity>[];

  /// First load and the pull-to-refresh path. [params] is how a caller scopes
  /// the register to one machine before it ever loads.
  Future<void> load({
    MaintenanceOrdersQueryParams? params,
    bool showLoader = true,
  }) async {
    if (isClosed) return;

    final MaintenanceOrdersQueryParams query = (params ?? _currentQuery)
        .copyWith(page: 1);

    if (showLoader) {
      emit(const MaintenanceListLoading());
    }

    await _ensureLocations();

    final result = await maintenanceRepo.fetchOrders(params: query);

    if (isClosed) return;

    result.fold(
      (ServerFailure failure) => emit(
        MaintenanceListFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (MaintenanceOrdersPage page) => emit(
        MaintenanceListLoaded(
          orders: page.orders,
          query: query,
          hasNext: page.meta.hasNext,
          total: page.meta.total,
          locations: _locations,
        ),
      ),
    );
  }

  Future<void> loadMore() async {
    final MaintenanceListState current = state;

    if (current is! MaintenanceListLoaded ||
        current.isLoadingMore ||
        !current.hasNext) {
      return;
    }

    emit(current.copyWith(isLoadingMore: true));

    final MaintenanceOrdersQueryParams next = current.query.copyWith(
      page: current.query.page + 1,
    );

    final result = await maintenanceRepo.fetchOrders(params: next);

    if (isClosed) return;

    result.fold(
      (ServerFailure _) => emit(current.copyWith(isLoadingMore: false)),
      (MaintenanceOrdersPage page) => emit(
        current.copyWith(
          orders: <MaintenanceOrderEntity>[...current.orders, ...page.orders],
          query: next,
          hasNext: page.meta.hasNext,
          total: page.meta.total,
          isLoadingMore: false,
        ),
      ),
    );
  }

  Future<void> applyFilters(MaintenanceOrdersQueryParams filters) {
    return load(params: filters.copyWith(page: 1), showLoader: false);
  }

  Future<void> clearFilters() {
    return load(params: _currentQuery.cleared(), showLoader: false);
  }

  /// Swaps one row in place after an action, so returning from the detail
  /// screen does not scroll the list back to the top.
  void replaceOrder(MaintenanceOrderEntity updated) {
    final MaintenanceListState current = state;
    if (current is! MaintenanceListLoaded) return;

    emit(
      current.copyWith(
        orders: current.orders
            .map(
              (MaintenanceOrderEntity order) =>
                  order.id == updated.id ? updated : order,
            )
            .toList(growable: false),
      ),
    );
  }

  MaintenanceOrdersQueryParams get _currentQuery {
    final MaintenanceListState current = state;
    return current is MaintenanceListLoaded
        ? current.query
        : const MaintenanceOrdersQueryParams();
  }

  Future<void> _ensureLocations() async {
    if (_locations.isNotEmpty) return;

    // Failing is not fatal: the list still renders and the filter sheet just
    // has one section fewer.
    final result = await getIt<LookupsRepo>().maintenanceLocations();
    _locations = result.getOrElse(() => _locations);
  }
}
