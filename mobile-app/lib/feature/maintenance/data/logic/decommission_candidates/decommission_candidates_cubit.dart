import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/maintenance/data/logic/decommission_candidates/decommission_candidates_state.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/domain/repos/maintenance_repo.dart';

class DecommissionCandidatesCubit extends Cubit<DecommissionCandidatesState> {
  DecommissionCandidatesCubit({required this.repo})
    : super(const DecommissionCandidatesLoading());

  final MaintenanceRepo repo;

  Future<void> load({
    DecommissionCandidatesQueryParams? query,
    bool showLoader = true,
  }) async {
    final params = (query ?? _query).copyWith(page: 1);
    if (showLoader) {
      emit(const DecommissionCandidatesLoading());
    }
    final result = await repo.fetchDecommissionCandidates(params: params);
    if (isClosed) return;
    result.fold(
      (f) => emit(
        DecommissionCandidatesFailure(
          errorMessage: f.errorMessage,
          isOffline: f is OfflineFailure,
        ),
      ),
      (page) => emit(
        DecommissionCandidatesLoaded(
          candidates: page.candidates,
          query: params,
          hasNext: page.meta.hasNext,
          total: page.meta.total,
          sort: _sort,
        ),
      ),
    );
  }

  Future<void> loadMore() async {
    final current = state;
    if (current is! DecommissionCandidatesLoaded ||
        current.isLoadingMore ||
        !current.hasNext) {
      return;
    }
    emit(current.copyWith(isLoadingMore: true));
    final next = current.query.copyWith(page: current.query.page + 1);
    final result = await repo.fetchDecommissionCandidates(params: next);
    if (isClosed) return;
    result.fold(
      (_) => emit(current.copyWith(isLoadingMore: false)),
      (page) => emit(
        current.copyWith(
          candidates: [...current.candidates, ...page.candidates],
          query: next,
          hasNext: page.meta.hasNext,
          total: page.meta.total,
          isLoadingMore: false,
        ),
      ),
    );
  }

  void setSort(DecommissionCandidateSort sort) {
    final current = state;
    if (current is DecommissionCandidatesLoaded) {
      emit(current.copyWith(sort: sort));
    }
  }

  DecommissionCandidatesQueryParams get _query =>
      state is DecommissionCandidatesLoaded
      ? (state as DecommissionCandidatesLoaded).query
      : const DecommissionCandidatesQueryParams();

  DecommissionCandidateSort get _sort => state is DecommissionCandidatesLoaded
      ? (state as DecommissionCandidatesLoaded).sort
      : DecommissionCandidateSort.costRatio;
}
