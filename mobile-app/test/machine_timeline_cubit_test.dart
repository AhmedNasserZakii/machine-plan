import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/feature/machines/data/logic/machine_timeline/machine_timeline_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_timeline/machine_timeline_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_timeline_event.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';

MachineTimelineEvent _event(String refId) => MachineTimelineEvent(
  at: DateTime(2026, 1, 1),
  type: MachineTimelineEventType.transferConfirmed,
  refId: refId,
);

/// Only `fetchTimeline` is exercised; every other method throws so a test
/// that accidentally calls the wrong one fails loudly instead of silently
/// returning a default.
class _FakeMachinesRepo implements MachinesRepo {
  Either<ServerFailure, MachineTimelinePage>? firstPageResult;
  Either<ServerFailure, MachineTimelinePage>? nextPageResult;
  String? lastCursorRequested;
  int calls = 0;

  @override
  Future<Either<ServerFailure, MachineTimelinePage>> fetchTimeline({
    required String machineId,
    String? cursor,
  }) async {
    calls++;
    lastCursorRequested = cursor;
    return cursor == null
        ? firstPageResult ?? Left(ServerFailure(''))
        : nextPageResult ?? Left(ServerFailure(''));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

void main() {
  late _FakeMachinesRepo repo;

  setUp(() {
    repo = _FakeMachinesRepo();
  });

  test(
    'load() emits the first page and keeps the cursor for loadMore',
    () async {
      repo.firstPageResult = Right(
        MachineTimelinePage(
          events: <MachineTimelineEvent>[_event('e1')],
          meta: const PaginationMetaModel(
            page: 1,
            limit: 30,
            total: 2,
            totalPages: 1,
            hasNext: true,
            nextCursor: 'cursor-1',
          ),
        ),
      );

      final MachineTimelineCubit cubit = MachineTimelineCubit(
        machinesRepo: repo,
        machineId: 'm1',
      );

      await cubit.load();

      final MachineTimelineState state = cubit.state;
      expect(state, isA<MachineTimelineLoaded>());
      final MachineTimelineLoaded loaded = state as MachineTimelineLoaded;
      expect(loaded.events, hasLength(1));
      expect(loaded.hasNext, isTrue);
      expect(loaded.cursor, 'cursor-1');

      await cubit.close();
    },
  );

  test('loadMore() appends events and forwards the stored cursor', () async {
    repo.firstPageResult = Right(
      MachineTimelinePage(
        events: <MachineTimelineEvent>[_event('e1')],
        meta: const PaginationMetaModel(
          page: 1,
          limit: 1,
          total: 2,
          totalPages: 2,
          hasNext: true,
          nextCursor: 'cursor-1',
        ),
      ),
    );
    repo.nextPageResult = Right(
      MachineTimelinePage(
        events: <MachineTimelineEvent>[_event('e2')],
        meta: const PaginationMetaModel(
          page: 2,
          limit: 1,
          total: 2,
          totalPages: 2,
          hasNext: false,
        ),
      ),
    );

    final MachineTimelineCubit cubit = MachineTimelineCubit(
      machinesRepo: repo,
      machineId: 'm1',
    );

    await cubit.load();
    await cubit.loadMore();

    final MachineTimelineLoaded loaded = cubit.state as MachineTimelineLoaded;
    expect(loaded.events.map((MachineTimelineEvent e) => e.refId), <String>[
      'e1',
      'e2',
    ]);
    expect(loaded.hasNext, isFalse);
    expect(repo.lastCursorRequested, 'cursor-1');

    await cubit.close();
  });

  test('a failed loadMore keeps the events already on screen', () async {
    repo.firstPageResult = Right(
      MachineTimelinePage(
        events: <MachineTimelineEvent>[_event('e1')],
        meta: const PaginationMetaModel(
          page: 1,
          limit: 1,
          total: 2,
          totalPages: 2,
          hasNext: true,
          nextCursor: 'cursor-1',
        ),
      ),
    );
    repo.nextPageResult = Left(ServerFailure('boom'));

    final MachineTimelineCubit cubit = MachineTimelineCubit(
      machinesRepo: repo,
      machineId: 'm1',
    );

    await cubit.load();
    await cubit.loadMore();

    final MachineTimelineLoaded loaded = cubit.state as MachineTimelineLoaded;
    expect(loaded.events, hasLength(1));
    expect(loaded.isLoadingMore, isFalse);
    // hasNext survives the failure so the user can try again.
    expect(loaded.hasNext, isTrue);

    await cubit.close();
  });

  test('an offline load() surfaces the offline flag', () async {
    repo.firstPageResult = Left(OfflineFailure());

    final MachineTimelineCubit cubit = MachineTimelineCubit(
      machinesRepo: repo,
      machineId: 'm1',
    );

    await cubit.load();

    final MachineTimelineFailure state = cubit.state as MachineTimelineFailure;
    expect(state.isOffline, isTrue);

    await cubit.close();
  });
}
