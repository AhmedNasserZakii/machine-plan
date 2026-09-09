import 'package:equatable/equatable.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';

sealed class ViolationDetailState extends Equatable {
  const ViolationDetailState();

  @override
  List<Object?> get props => <Object?>[];
}

class ViolationDetailLoading extends ViolationDetailState {
  const ViolationDetailLoading();
}

class ViolationDetailLoaded extends ViolationDetailState {
  const ViolationDetailLoaded({
    required this.violation,
    this.actionInProgress = false,
  });

  final ViolationEntity violation;

  /// Blocks a second tap on charge or waive while the first is in flight —
  /// charging twice writes two finance transactions.
  final bool actionInProgress;

  ViolationDetailLoaded copyWith({
    ViolationEntity? violation,
    bool? actionInProgress,
  }) {
    return ViolationDetailLoaded(
      violation: violation ?? this.violation,
      actionInProgress: actionInProgress ?? this.actionInProgress,
    );
  }

  @override
  List<Object?> get props => <Object?>[violation, actionInProgress];
}

class ViolationDetailFailure extends ViolationDetailState {
  const ViolationDetailFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
