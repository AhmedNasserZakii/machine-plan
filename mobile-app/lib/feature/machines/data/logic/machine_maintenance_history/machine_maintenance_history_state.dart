import 'package:equatable/equatable.dart';
import 'package:machinery/feature/machines/domain/entities/machine_maintenance_history.dart';

sealed class MachineMaintenanceHistoryState extends Equatable {
  const MachineMaintenanceHistoryState();

  @override
  List<Object?> get props => <Object?>[];
}

class MachineMaintenanceHistoryLoading extends MachineMaintenanceHistoryState {
  const MachineMaintenanceHistoryLoading();
}

class MachineMaintenanceHistoryLoaded extends MachineMaintenanceHistoryState {
  const MachineMaintenanceHistoryLoaded({
    required this.history,
    this.isLoadingMore = false,
  });

  final MachineMaintenanceHistory history;
  final bool isLoadingMore;

  bool get hasNext => history.ordersMeta.hasNext;
  int get page => history.ordersMeta.page;

  MachineMaintenanceHistoryLoaded copyWith({
    MachineMaintenanceHistory? history,
    bool? isLoadingMore,
  }) {
    return MachineMaintenanceHistoryLoaded(
      history: history ?? this.history,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    );
  }

  @override
  List<Object?> get props => <Object?>[history, isLoadingMore];
}

class MachineMaintenanceHistoryFailure extends MachineMaintenanceHistoryState {
  const MachineMaintenanceHistoryFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
