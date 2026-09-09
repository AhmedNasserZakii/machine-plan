import 'package:equatable/equatable.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfers_query_params.dart';

sealed class TransfersListState extends Equatable {
  const TransfersListState();

  @override
  List<Object?> get props => <Object?>[];
}

class TransfersListInitial extends TransfersListState {
  const TransfersListInitial();
}

class TransfersListLoading extends TransfersListState {
  const TransfersListLoading();
}

class TransfersListLoaded extends TransfersListState {
  const TransfersListLoaded({
    required this.transfers,
    required this.query,
    required this.hasNext,
    required this.total,
    this.isLoadingMore = false,
    this.incomingCount = 0,
  });

  final List<TransferEntity> transfers;
  final TransfersQueryParams query;
  final bool hasNext;
  final int total;
  final bool isLoadingMore;

  /// The badge on the inbox tab. Read from the incoming endpoint's `total`, so
  /// it stays right even while the user is looking at another tab.
  final int incomingCount;

  TransfersListLoaded copyWith({
    List<TransferEntity>? transfers,
    TransfersQueryParams? query,
    bool? hasNext,
    int? total,
    bool? isLoadingMore,
    int? incomingCount,
  }) {
    return TransfersListLoaded(
      transfers: transfers ?? this.transfers,
      query: query ?? this.query,
      hasNext: hasNext ?? this.hasNext,
      total: total ?? this.total,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      incomingCount: incomingCount ?? this.incomingCount,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    transfers,
    query,
    hasNext,
    total,
    isLoadingMore,
    incomingCount,
  ];
}

class TransfersListFailure extends TransfersListState {
  const TransfersListFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
