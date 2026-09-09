import 'package:equatable/equatable.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/params/machines_query_params.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

sealed class MachinesListState extends Equatable {
  const MachinesListState();

  @override
  List<Object?> get props => <Object?>[];
}

class MachinesListInitial extends MachinesListState {
  const MachinesListInitial();
}

class MachinesListLoading extends MachinesListState {
  const MachinesListLoading();
}

class MachinesListLoaded extends MachinesListState {
  const MachinesListLoaded({
    required this.machines,
    required this.query,
    required this.hasNext,
    required this.total,
    this.isLoadingMore = false,
    this.types = const <MachineTypeEntity>[],
    this.models = const <MachineModelEntity>[],
    this.branches = const <BranchEntity>[],
  });

  final List<MachineEntity> machines;
  final MachinesQueryParams query;
  final bool hasNext;
  final int total;
  final bool isLoadingMore;

  /// Loaded once and carried across refreshes so the filter sheet opens
  /// instantly instead of showing a spinner over a spinner.
  final List<MachineTypeEntity> types;
  final List<MachineModelEntity> models;
  final List<BranchEntity> branches;

  MachinesListLoaded copyWith({
    List<MachineEntity>? machines,
    MachinesQueryParams? query,
    bool? hasNext,
    int? total,
    bool? isLoadingMore,
    List<MachineTypeEntity>? types,
    List<MachineModelEntity>? models,
    List<BranchEntity>? branches,
  }) {
    return MachinesListLoaded(
      machines: machines ?? this.machines,
      query: query ?? this.query,
      hasNext: hasNext ?? this.hasNext,
      total: total ?? this.total,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      types: types ?? this.types,
      models: models ?? this.models,
      branches: branches ?? this.branches,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    machines,
    query,
    hasNext,
    total,
    isLoadingMore,
    types,
    models,
    branches,
  ];
}

class MachinesListFailure extends MachinesListState {
  const MachinesListFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
