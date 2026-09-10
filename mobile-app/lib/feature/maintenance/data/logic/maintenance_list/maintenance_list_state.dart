import 'package:equatable/equatable.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';

sealed class MaintenanceListState extends Equatable {
  const MaintenanceListState();

  @override
  List<Object?> get props => <Object?>[];
}

class MaintenanceListInitial extends MaintenanceListState {
  const MaintenanceListInitial();
}

class MaintenanceListLoading extends MaintenanceListState {
  const MaintenanceListLoading();
}

class MaintenanceListLoaded extends MaintenanceListState {
  const MaintenanceListLoaded({
    required this.orders,
    required this.query,
    required this.hasNext,
    required this.total,
    this.isLoadingMore = false,
    this.locations = const <LookupEntity>[],
  });

  final List<MaintenanceOrderEntity> orders;
  final MaintenanceOrdersQueryParams query;
  final bool hasNext;
  final int total;
  final bool isLoadingMore;

  /// Loaded once and carried across refreshes so the filter sheet opens
  /// instantly instead of showing a spinner over a spinner.
  final List<LookupEntity> locations;

  MaintenanceListLoaded copyWith({
    List<MaintenanceOrderEntity>? orders,
    MaintenanceOrdersQueryParams? query,
    bool? hasNext,
    int? total,
    bool? isLoadingMore,
    List<LookupEntity>? locations,
  }) {
    return MaintenanceListLoaded(
      orders: orders ?? this.orders,
      query: query ?? this.query,
      hasNext: hasNext ?? this.hasNext,
      total: total ?? this.total,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      locations: locations ?? this.locations,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    orders,
    query,
    hasNext,
    total,
    isLoadingMore,
    locations,
  ];
}

class MaintenanceListFailure extends MaintenanceListState {
  const MaintenanceListFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
