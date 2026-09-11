import 'package:equatable/equatable.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';

enum DecommissionCandidateSort { costRatio, repairCount, age }

sealed class DecommissionCandidatesState extends Equatable {
  const DecommissionCandidatesState();
  @override
  List<Object?> get props => const [];
}

class DecommissionCandidatesLoading extends DecommissionCandidatesState {
  const DecommissionCandidatesLoading();
}

class DecommissionCandidatesFailure extends DecommissionCandidatesState {
  const DecommissionCandidatesFailure({
    required this.errorMessage,
    this.isOffline = false,
  });
  final String errorMessage;
  final bool isOffline;
  @override
  List<Object?> get props => [errorMessage, isOffline];
}

class DecommissionCandidatesLoaded extends DecommissionCandidatesState {
  const DecommissionCandidatesLoaded({
    required this.candidates,
    required this.query,
    required this.hasNext,
    required this.total,
    this.sort = DecommissionCandidateSort.costRatio,
    this.isLoadingMore = false,
  });

  final List<DecommissionCandidateEntity> candidates;
  final DecommissionCandidatesQueryParams query;
  final bool hasNext;
  final int total;
  final DecommissionCandidateSort sort;
  final bool isLoadingMore;

  List<DecommissionCandidateEntity> get sortedCandidates {
    final result = [...candidates];
    result.sort(
      (a, b) => switch (sort) {
        DecommissionCandidateSort.costRatio => (b.costRatio ?? -1).compareTo(
          a.costRatio ?? -1,
        ),
        DecommissionCandidateSort.repairCount => b.repairCount.compareTo(
          a.repairCount,
        ),
        DecommissionCandidateSort.age => b.ageMonths.compareTo(a.ageMonths),
      },
    );
    return result;
  }

  DecommissionCandidatesLoaded copyWith({
    List<DecommissionCandidateEntity>? candidates,
    DecommissionCandidatesQueryParams? query,
    bool? hasNext,
    int? total,
    DecommissionCandidateSort? sort,
    bool? isLoadingMore,
  }) => DecommissionCandidatesLoaded(
    candidates: candidates ?? this.candidates,
    query: query ?? this.query,
    hasNext: hasNext ?? this.hasNext,
    total: total ?? this.total,
    sort: sort ?? this.sort,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
  );

  @override
  List<Object?> get props => [
    candidates,
    query,
    hasNext,
    total,
    sort,
    isLoadingMore,
  ];
}
