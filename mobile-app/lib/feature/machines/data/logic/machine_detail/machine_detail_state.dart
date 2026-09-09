import 'package:equatable/equatable.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';

sealed class MachineDetailState extends Equatable {
  const MachineDetailState();

  @override
  List<Object?> get props => <Object?>[];
}

class MachineDetailLoading extends MachineDetailState {
  const MachineDetailLoading();
}

class MachineDetailLoaded extends MachineDetailState {
  const MachineDetailLoaded({
    required this.machine,
    this.chain = const <MachineEntity>[],
  });

  final MachineEntity machine;

  /// Every serial this unit has ever been, oldest first. Only fetched when the
  /// machine actually points at a predecessor or successor — asking for a chain
  /// that cannot exist is a request per detail view for nothing.
  final List<MachineEntity> chain;

  bool get hasChain => chain.length > 1;

  MachineDetailLoaded copyWith({
    MachineEntity? machine,
    List<MachineEntity>? chain,
  }) {
    return MachineDetailLoaded(
      machine: machine ?? this.machine,
      chain: chain ?? this.chain,
    );
  }

  @override
  List<Object?> get props => <Object?>[machine, chain];
}

class MachineDetailFailure extends MachineDetailState {
  const MachineDetailFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
