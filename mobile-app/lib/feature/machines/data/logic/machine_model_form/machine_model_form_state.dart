import 'package:equatable/equatable.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';

sealed class MachineModelFormState extends Equatable {
  const MachineModelFormState();

  @override
  List<Object?> get props => <Object?>[];
}

class MachineModelFormLoading extends MachineModelFormState {
  const MachineModelFormLoading();
}

class MachineModelFormReady extends MachineModelFormState {
  const MachineModelFormReady({
    required this.types,
    this.selectedType,
    this.isActive = true,
    this.isSubmitting = false,
    this.fieldErrors = const <String, String>{},
  });

  final List<MachineTypeEntity> types;
  final MachineTypeEntity? selectedType;
  final bool isActive;
  final bool isSubmitting;
  final Map<String, String> fieldErrors;

  MachineModelFormReady copyWith({
    List<MachineTypeEntity>? types,
    MachineTypeEntity? selectedType,
    bool? isActive,
    bool? isSubmitting,
    Map<String, String>? fieldErrors,
    bool clearSelectedType = false,
  }) {
    return MachineModelFormReady(
      types: types ?? this.types,
      selectedType: clearSelectedType
          ? null
          : (selectedType ?? this.selectedType),
      isActive: isActive ?? this.isActive,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      fieldErrors: fieldErrors ?? this.fieldErrors,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    types,
    selectedType,
    isActive,
    isSubmitting,
    fieldErrors,
  ];
}

class MachineModelFormLoadFailure extends MachineModelFormState {
  const MachineModelFormLoadFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}

class MachineModelFormSubmitted extends MachineModelFormState {
  const MachineModelFormSubmitted({
    required this.model,
    required this.wasCreated,
  });

  final MachineModelEntity model;
  final bool wasCreated;

  @override
  List<Object?> get props => <Object?>[model, wasCreated];
}

class MachineModelFormSubmitFailure extends MachineModelFormState {
  const MachineModelFormSubmitFailure({required this.errorMessage});

  final String errorMessage;

  @override
  List<Object?> get props => <Object?>[errorMessage];
}
