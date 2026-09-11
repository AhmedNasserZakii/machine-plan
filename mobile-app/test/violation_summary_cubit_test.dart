import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/violations/data/logic/violation_summary/violation_summary_cubit.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/repos/violations_repo.dart';

const ViolationSummary _summary = ViolationSummary(
  user: ViolationUserRef(id: 'u1', fullName: 'Ahmed'),
  totals: ViolationTotals(all: 3, open: 1, charged: 1, waived: 1),
  trend: ViolationTrend.improving,
);

class _FakeViolationsRepo implements ViolationsRepo {
  Either<ServerFailure, ViolationSummary>? result;
  String? lastUserId;

  @override
  Future<Either<ServerFailure, ViolationSummary>> fetchSummary({
    required String userId,
  }) async {
    lastUserId = userId;
    return result ?? Left(ServerFailure(''));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError(invocation.memberName.toString());
}

void main() {
  test(
    'load() fetches the summary for the exact user it was built for',
    () async {
      final _FakeViolationsRepo repo = _FakeViolationsRepo()
        ..result = const Right(_summary);

      final ViolationSummaryCubit cubit = ViolationSummaryCubit(
        violationsRepo: repo,
        userId: 'u1',
      );

      await cubit.load();

      expect(cubit.state, isA<ViolationSummaryLoaded>());
      expect((cubit.state as ViolationSummaryLoaded).summary, _summary);
      expect(repo.lastUserId, 'u1');

      await cubit.close();
    },
  );

  test('a failed load surfaces the offline flag', () async {
    final _FakeViolationsRepo repo = _FakeViolationsRepo()
      ..result = Left(OfflineFailure());

    final ViolationSummaryCubit cubit = ViolationSummaryCubit(
      violationsRepo: repo,
      userId: 'u1',
    );

    await cubit.load();

    expect((cubit.state as ViolationSummaryFailure).isOffline, isTrue);

    await cubit.close();
  });
}
