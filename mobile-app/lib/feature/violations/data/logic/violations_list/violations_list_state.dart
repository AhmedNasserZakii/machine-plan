import 'package:equatable/equatable.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/params/violations_query_params.dart';

sealed class ViolationsListState extends Equatable {
  const ViolationsListState();

  @override
  List<Object?> get props => <Object?>[];
}

class ViolationsListInitial extends ViolationsListState {
  const ViolationsListInitial();
}

class ViolationsListLoading extends ViolationsListState {
  const ViolationsListLoading();
}

class ViolationsListLoaded extends ViolationsListState {
  const ViolationsListLoaded({
    required this.violations,
    required this.query,
    required this.hasNext,
    required this.total,
    this.isLoadingMore = false,
    this.types = const <LookupEntity>[],
  });

  final List<ViolationEntity> violations;
  final ViolationsQueryParams query;
  final bool hasNext;
  final int total;
  final bool isLoadingMore;

  /// Loaded once and carried across refreshes so the filter sheet opens
  /// instantly instead of showing a spinner over a spinner.
  final List<LookupEntity> types;

  ViolationsListLoaded copyWith({
    List<ViolationEntity>? violations,
    ViolationsQueryParams? query,
    bool? hasNext,
    int? total,
    bool? isLoadingMore,
    List<LookupEntity>? types,
  }) {
    return ViolationsListLoaded(
      violations: violations ?? this.violations,
      query: query ?? this.query,
      hasNext: hasNext ?? this.hasNext,
      total: total ?? this.total,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      types: types ?? this.types,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    violations,
    query,
    hasNext,
    total,
    isLoadingMore,
    types,
  ];
}

class ViolationsListFailure extends ViolationsListState {
  const ViolationsListFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
