import 'dart:async';

import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/data/logic/machines_list/machines_list_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/params/machines_query_params.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

class MachinesListCubit extends Cubit<MachinesListState> {
  MachinesListCubit({required this.machinesRepo})
    : super(const MachinesListInitial());

  final MachinesRepo machinesRepo;

  /// Typing in the search box must not fire a request per keystroke, and a
  /// serial is long enough that a per-character search would be mostly waste.
  static const Duration searchDebounce = Duration(milliseconds: 350);

  Timer? _searchTimer;

  List<MachineTypeEntity> _types = const <MachineTypeEntity>[];
  List<MachineModelEntity> _models = const <MachineModelEntity>[];
  List<BranchEntity> _branches = const <BranchEntity>[];

  @override
  Future<void> close() {
    _searchTimer?.cancel();
    return super.close();
  }

  /// First load and the pull-to-refresh path. Keeps whatever filters are
  /// already applied unless [params] overrides them.
  Future<void> load({
    MachinesQueryParams? params,
    bool showLoader = true,
  }) async {
    if (isClosed) {
      return;
    }

    final MachinesQueryParams query = (params ?? _currentQuery).copyWith(
      page: 1,
    );

    if (showLoader) {
      emit(const MachinesListLoading());
    }

    // The catalogue only needs fetching once; a refresh should not re-pull it.
    await _ensureLookups();

    final result = await machinesRepo.fetchMachines(params: query);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        MachinesListFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (MachinesPage page) => emit(
        MachinesListLoaded(
          machines: page.machines,
          query: query,
          hasNext: page.meta.hasNext,
          total: page.meta.total,
          types: _types,
          models: _models,
          branches: _branches,
        ),
      ),
    );
  }

  Future<void> loadMore() async {
    final MachinesListState current = state;

    if (current is! MachinesListLoaded ||
        current.isLoadingMore ||
        !current.hasNext) {
      return;
    }

    emit(current.copyWith(isLoadingMore: true));

    final MachinesQueryParams next = current.query.copyWith(
      page: current.query.page + 1,
    );

    final result = await machinesRepo.fetchMachines(params: next);

    if (isClosed) {
      return;
    }

    result.fold(
      // A failed page must not wipe the pages already on screen.
      (ServerFailure _) => emit(current.copyWith(isLoadingMore: false)),
      (MachinesPage page) => emit(
        current.copyWith(
          machines: <MachineEntity>[...current.machines, ...page.machines],
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

  /// Used by the scan button: a resolved serial goes straight into the search
  /// box, no debounce, because the user has already committed to it.
  Future<void> searchNow(String term) {
    _searchTimer?.cancel();
    return load(
      params: _currentQuery.copyWith(search: term.trim()),
      showLoader: false,
    );
  }

  Future<void> applyFilters(MachinesQueryParams filters) {
    return load(params: filters.copyWith(page: 1), showLoader: false);
  }

  Future<void> clearFilters() {
    return load(params: _currentQuery.cleared(), showLoader: false);
  }

  /// Drops one filter from the chip row without opening the sheet.
  Future<void> removeStatus(MachineStatus status) {
    return load(
      params: _currentQuery.copyWith(
        statuses: _currentQuery.statuses
            .where((MachineStatus row) => row != status)
            .toList(growable: false),
      ),
      showLoader: false,
    );
  }

  /// Swaps one row in place after an edit, so returning from the detail screen
  /// does not scroll the list back to the top.
  void replaceMachine(MachineEntity updated) {
    final MachinesListState current = state;
    if (current is! MachinesListLoaded) {
      return;
    }

    emit(
      current.copyWith(
        machines: current.machines
            .map(
              (MachineEntity machine) =>
                  machine.id == updated.id ? updated : machine,
            )
            .toList(growable: false),
      ),
    );
  }

  MachinesQueryParams get _currentQuery {
    final MachinesListState current = state;
    return current is MachinesListLoaded
        ? current.query
        : const MachinesQueryParams();
  }

  Future<void> _ensureLookups() async {
    if (_models.isNotEmpty) {
      return;
    }

    final (
      Either<ServerFailure, List<MachineTypeEntity>> types,
      Either<ServerFailure, List<MachineModelEntity>> models,
      Either<ServerFailure, List<BranchEntity>> branches,
    ) = await (
      machinesRepo.fetchMachineTypes(),
      machinesRepo.fetchMachineModels(),
      machinesRepo.fetchBranches(),
    ).wait;

    // Lookups failing is not fatal: the list still renders, the filter sheet
    // just has less to offer.
    _types = types.getOrElse(() => _types);
    _models = models.getOrElse(() => _models);
    _branches = branches.getOrElse(() => _branches);
  }
}
