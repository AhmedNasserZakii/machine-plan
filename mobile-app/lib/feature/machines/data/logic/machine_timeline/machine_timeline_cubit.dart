import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/machines/data/logic/machine_timeline/machine_timeline_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_timeline_event.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';

/// Newest-first, keyset-paginated life story of one machine (`8.1`).
class MachineTimelineCubit extends Cubit<MachineTimelineState> {
  MachineTimelineCubit({required this.machinesRepo, required this.machineId})
    : super(const MachineTimelineLoading());

  final MachinesRepo machinesRepo;
  final String machineId;

  Future<void> load() async {
    if (isClosed) {
      return;
    }

    emit(const MachineTimelineLoading());

    final result = await machinesRepo.fetchTimeline(machineId: machineId);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        MachineTimelineFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (page) => emit(
        MachineTimelineLoaded(
          events: page.events,
          hasNext: page.meta.hasNext,
          cursor: page.meta.nextCursor,
        ),
      ),
    );
  }

  Future<void> loadMore() async {
    final MachineTimelineState current = state;

    if (current is! MachineTimelineLoaded ||
        current.isLoadingMore ||
        !current.hasNext) {
      return;
    }

    emit(current.copyWith(isLoadingMore: true));

    final result = await machinesRepo.fetchTimeline(
      machineId: machineId,
      cursor: current.cursor,
    );

    if (isClosed) {
      return;
    }

    result.fold(
      // A failed page must not wipe the events already on screen.
      (ServerFailure _) => emit(current.copyWith(isLoadingMore: false)),
      (page) => emit(
        current.copyWith(
          events: <MachineTimelineEvent>[...current.events, ...page.events],
          hasNext: page.meta.hasNext,
          cursor: page.meta.nextCursor,
          isLoadingMore: false,
        ),
      ),
    );
  }
}
