import 'package:equatable/equatable.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';

sealed class MachineFormState extends Equatable {
  const MachineFormState();

  @override
  List<Object?> get props => <Object?>[];
}

class MachineFormLoading extends MachineFormState {
  const MachineFormLoading();
}

/// The form is usable. [selectedModel] drives whether the SIM field is shown at
/// all, so it is held as the resolved model rather than a bare id.
class MachineFormReady extends MachineFormState {
  const MachineFormReady({
    required this.models,
    this.selectedModel,
    this.warrantyStart,
    this.warrantyEnd,
    this.hasBox = true,
    this.isSubmitting = false,
    this.fieldErrors = const <String, String>{},
  });

  final List<MachineModelEntity> models;
  final MachineModelEntity? selectedModel;

  /// Held here rather than in a controller because both ends are picked from
  /// one date-range control and validated against each other.
  final String? warrantyStart;
  final String? warrantyEnd;

  final bool hasBox;
  final bool isSubmitting;

  /// Server-side 400 details, rendered under the matching field.
  final Map<String, String> fieldErrors;

  /// A pin pad has no mobile line, and the server rejects a SIM serial sent for
  /// one — so the field is hidden rather than shown and then refused.
  bool get requiresSim => selectedModel?.type.requiresSim ?? true;

  MachineFormReady copyWith({
    List<MachineModelEntity>? models,
    MachineModelEntity? selectedModel,
    String? warrantyStart,
    String? warrantyEnd,
    bool? hasBox,
    bool? isSubmitting,
    Map<String, String>? fieldErrors,
    bool clearWarrantyStart = false,
    bool clearWarrantyEnd = false,
  }) {
    return MachineFormReady(
      models: models ?? this.models,
      selectedModel: selectedModel ?? this.selectedModel,
      warrantyStart: clearWarrantyStart
          ? null
          : (warrantyStart ?? this.warrantyStart),
      warrantyEnd: clearWarrantyEnd ? null : (warrantyEnd ?? this.warrantyEnd),
      hasBox: hasBox ?? this.hasBox,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      fieldErrors: fieldErrors ?? this.fieldErrors,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    models,
    selectedModel,
    warrantyStart,
    warrantyEnd,
    hasBox,
    isSubmitting,
    fieldErrors,
  ];
}

class MachineFormLoadFailure extends MachineFormState {
  const MachineFormLoadFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}

/// Emitted once on success so the screen can pop and the list can refresh.
class MachineFormSubmitted extends MachineFormState {
  const MachineFormSubmitted({required this.machine, required this.wasCreated});

  final MachineEntity machine;
  final bool wasCreated;

  @override
  List<Object?> get props => <Object?>[machine, wasCreated];
}

class MachineFormSubmitFailure extends MachineFormState {
  const MachineFormSubmitFailure({required this.errorMessage});

  final String errorMessage;

  @override
  List<Object?> get props => <Object?>[errorMessage];
}
