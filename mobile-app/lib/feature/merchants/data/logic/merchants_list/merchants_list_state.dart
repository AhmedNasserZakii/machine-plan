import 'package:equatable/equatable.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/domain/params/merchants_query_params.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

sealed class MerchantsListState extends Equatable {
  const MerchantsListState();

  @override
  List<Object?> get props => <Object?>[];
}

class MerchantsListInitial extends MerchantsListState {
  const MerchantsListInitial();
}

class MerchantsListLoading extends MerchantsListState {
  const MerchantsListLoading();
}

class MerchantsListLoaded extends MerchantsListState {
  const MerchantsListLoaded({
    required this.merchants,
    required this.query,
    required this.hasNext,
    required this.total,
    this.isLoadingMore = false,
    this.branches = const <BranchEntity>[],
  });

  final List<MerchantEntity> merchants;
  final MerchantsQueryParams query;
  final bool hasNext;
  final int total;
  final bool isLoadingMore;

  /// Loaded once and carried across refreshes so the filter sheet opens
  /// instantly instead of showing a spinner over a spinner. Empty for a
  /// representative, who cannot read the branch list and does not need it.
  final List<BranchEntity> branches;

  MerchantsListLoaded copyWith({
    List<MerchantEntity>? merchants,
    MerchantsQueryParams? query,
    bool? hasNext,
    int? total,
    bool? isLoadingMore,
    List<BranchEntity>? branches,
  }) {
    return MerchantsListLoaded(
      merchants: merchants ?? this.merchants,
      query: query ?? this.query,
      hasNext: hasNext ?? this.hasNext,
      total: total ?? this.total,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      branches: branches ?? this.branches,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    merchants,
    query,
    hasNext,
    total,
    isLoadingMore,
    branches,
  ];
}

class MerchantsListFailure extends MerchantsListState {
  const MerchantsListFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
