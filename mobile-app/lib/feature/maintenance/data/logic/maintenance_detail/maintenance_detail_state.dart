import 'package:equatable/equatable.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';

sealed class MaintenanceDetailState extends Equatable {
  const MaintenanceDetailState();

  @override
  List<Object?> get props => <Object?>[];
}

class MaintenanceDetailLoading extends MaintenanceDetailState {
  const MaintenanceDetailLoading();
}

class MaintenanceDetailLoaded extends MaintenanceDetailState {
  const MaintenanceDetailLoaded({
    required this.order,
    this.actionInProgress = false,
  });

  final MaintenanceOrderEntity order;
  final bool actionInProgress;

  MaintenanceDetailLoaded copyWith({
    MaintenanceOrderEntity? order,
    bool? actionInProgress,
  }) {
    return MaintenanceDetailLoaded(
      order: order ?? this.order,
      actionInProgress: actionInProgress ?? this.actionInProgress,
    );
  }

  @override
  List<Object?> get props => <Object?>[order, actionInProgress];
}

class MaintenanceDetailFailure extends MaintenanceDetailState {
  const MaintenanceDetailFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
