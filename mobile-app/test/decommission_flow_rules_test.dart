import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/feature/maintenance/data/logic/decommission_candidates/decommission_candidates_state.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';

DecommissionCandidateEntity candidate({
  required String id,
  required double ratio,
  required int repairs,
  required int age,
}) => DecommissionCandidateEntity(
  id: id,
  serial: id,
  status: 'IN_COMPANY_WAREHOUSE',
  cumulativeRepairCost: 100,
  repairCount: repairs,
  ageMonths: age,
  isInChain: false,
  chainLength: 1,
  recommendation: DecommissionRecommendation.review,
  costRatio: ratio,
);

void main() {
  test('candidate thresholds serialize all three backend filters', () {
    const query = DecommissionCandidatesQueryParams(
      page: 2,
      minCostRatio: .65,
      minRepairCount: 4,
      minAgeMonths: 18,
    );

    expect(query.hasFilters, isTrue);
    expect(query.toQuery(), {
      'page': 2,
      'limit': 20,
      'minCostRatio': .65,
      'minRepairCount': 4,
      'minAgeMonths': 18,
    });
  });

  test('clearing candidate thresholds preserves no stale values', () {
    const query = DecommissionCandidatesQueryParams(
      minCostRatio: .65,
      minRepairCount: 4,
      minAgeMonths: 18,
    );

    final cleared = query.copyWith(
      clearMinCostRatio: true,
      clearMinRepairCount: true,
      clearMinAgeMonths: true,
    );
    expect(cleared.hasFilters, isFalse);
  });

  test('candidate list sorts independently by cost, repairs, and age', () {
    final rows = [
      candidate(id: 'a', ratio: .5, repairs: 9, age: 12),
      candidate(id: 'b', ratio: .9, repairs: 2, age: 24),
      candidate(id: 'c', ratio: .7, repairs: 4, age: 48),
    ];

    DecommissionCandidatesLoaded state(DecommissionCandidateSort sort) =>
        DecommissionCandidatesLoaded(
          candidates: rows,
          query: const DecommissionCandidatesQueryParams(),
          hasNext: false,
          total: 3,
          sort: sort,
        );

    expect(
      state(
        DecommissionCandidateSort.costRatio,
      ).sortedCandidates.map((e) => e.id),
      ['b', 'c', 'a'],
    );
    expect(
      state(
        DecommissionCandidateSort.repairCount,
      ).sortedCandidates.map((e) => e.id),
      ['a', 'c', 'b'],
    );
    expect(
      state(DecommissionCandidateSort.age).sortedCandidates.map((e) => e.id),
      ['c', 'b', 'a'],
    );
  });

  test('decommission payload includes the irreversible decision fields', () {
    const params = DecommissionMachineParams(
      reasonId: 'reason-1',
      notes: 'Repair cost is no longer economical',
      decommissionedAt: '2026-09-11T09:00:00.000Z',
    );

    expect(params.toJson(), {
      'reasonId': 'reason-1',
      'notes': 'Repair cost is no longer economical',
      'decommissionedAt': '2026-09-11T09:00:00.000Z',
    });
  });
}
