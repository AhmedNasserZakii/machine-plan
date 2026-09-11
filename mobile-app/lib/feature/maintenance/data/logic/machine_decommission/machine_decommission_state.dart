import 'package:equatable/equatable.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';

sealed class MachineDecommissionState extends Equatable {
  const MachineDecommissionState();

  @override
  List<Object?> get props => <Object?>[];
}

class MachineDecommissionLoading extends MachineDecommissionState {
  const MachineDecommissionLoading();
}

class MachineDecommissionReady extends MachineDecommissionState {
  const MachineDecommissionReady({
    required this.reasons,
    required this.summary,
    this.isSubmitting = false,
    this.fieldErrors = const <String, String>{},
  });

  final List<LookupEntity> reasons;
  final MachineCostSummary summary;
  final bool isSubmitting;
  final Map<String, String> fieldErrors;

  MachineDecommissionReady copyWith({
    bool? isSubmitting,
    Map<String, String>? fieldErrors,
  }) => MachineDecommissionReady(
    reasons: reasons,
    summary: summary,
    isSubmitting: isSubmitting ?? this.isSubmitting,
    fieldErrors: fieldErrors ?? this.fieldErrors,
  );

  @override
  List<Object?> get props => <Object?>[
    reasons,
    summary,
    isSubmitting,
    fieldErrors,
  ];
}

class MachineDecommissionFailure extends MachineDecommissionState {
  const MachineDecommissionFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}

class MachineDecommissionSubmitFailure extends MachineDecommissionState {
  const MachineDecommissionSubmitFailure({required this.errorMessage});

  final String errorMessage;

  @override
  List<Object?> get props => <Object?>[errorMessage];
}

class MachineDecommissionSubmitted extends MachineDecommissionState {
  const MachineDecommissionSubmitted({required this.decommission});

  final DecommissionEntity decommission;

  @override
  List<Object?> get props => <Object?>[decommission];
}
