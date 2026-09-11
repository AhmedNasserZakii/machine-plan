import 'package:equatable/equatable.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';

sealed class MachineReplacementState extends Equatable {
  const MachineReplacementState();

  @override
  List<Object?> get props => <Object?>[];
}

class MachineReplacementReady extends MachineReplacementState {
  const MachineReplacementReady({
    this.isSubmitting = false,
    this.fieldErrors = const <String, String>{},
  });

  final bool isSubmitting;
  final Map<String, String> fieldErrors;

  @override
  List<Object?> get props => <Object?>[isSubmitting, fieldErrors];
}

class MachineReplacementFailure extends MachineReplacementState {
  const MachineReplacementFailure({required this.errorMessage});

  final String errorMessage;

  @override
  List<Object?> get props => <Object?>[errorMessage];
}

/// The swap committed, but one of the mandatory follow-up reads failed. The
/// form must close (submitting again would be wrong); its caller will reload.
class MachineReplacementRefreshFailure extends MachineReplacementState {
  const MachineReplacementRefreshFailure({required this.errorMessage});

  final String errorMessage;

  @override
  List<Object?> get props => <Object?>[errorMessage];
}

/// Both sides are fetched after the write. The caller can therefore replace
/// the stale old-machine detail immediately and already has the new record if
/// it chooses to open the next link in the chain.
class MachineReplacementSubmitted extends MachineReplacementState {
  const MachineReplacementSubmitted({
    required this.oldMachine,
    required this.newMachine,
  });

  final MachineEntity oldMachine;
  final MachineEntity newMachine;

  @override
  List<Object?> get props => <Object?>[oldMachine, newMachine];
}
