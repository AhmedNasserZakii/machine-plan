import 'package:equatable/equatable.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';

sealed class ViolationCreateState extends Equatable {
  const ViolationCreateState();

  @override
  List<Object?> get props => <Object?>[];
}

class ViolationCreateLoading extends ViolationCreateState {
  const ViolationCreateLoading();
}

class ViolationCreateLoadFailure extends ViolationCreateState {
  const ViolationCreateLoadFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}

class ViolationCreateReady extends ViolationCreateState {
  const ViolationCreateReady({
    required this.types,
    this.typeId,
    this.severity,
    this.user,
    this.machine,
    this.isSubmitting = false,
  });

  final List<LookupEntity> types;
  final String? typeId;
  final ViolationSeverity? severity;
  final UserEntity? user;
  final MachineEntity? machine;
  final bool isSubmitting;

  ViolationCreateReady copyWith({
    String? typeId,
    ViolationSeverity? severity,
    UserEntity? user,
    MachineEntity? machine,
    bool clearMachine = false,
    bool? isSubmitting,
  }) {
    return ViolationCreateReady(
      types: types,
      typeId: typeId ?? this.typeId,
      severity: severity ?? this.severity,
      user: user ?? this.user,
      machine: clearMachine ? null : (machine ?? this.machine),
      isSubmitting: isSubmitting ?? this.isSubmitting,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    types,
    typeId,
    severity,
    user,
    machine,
    isSubmitting,
  ];
}

/// Emitted once on success so the screen can pop with the new row.
class ViolationCreateSubmitted extends ViolationCreateState {
  const ViolationCreateSubmitted({required this.violation});

  final ViolationEntity violation;

  @override
  List<Object?> get props => <Object?>[violation];
}

class ViolationCreateSubmitFailure extends ViolationCreateState {
  const ViolationCreateSubmitFailure({required this.errorMessage});

  final String errorMessage;

  @override
  List<Object?> get props => <Object?>[errorMessage];
}
