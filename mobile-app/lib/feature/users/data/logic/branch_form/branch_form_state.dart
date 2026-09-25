import 'package:equatable/equatable.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

sealed class BranchFormState extends Equatable {
  const BranchFormState();

  @override
  List<Object?> get props => <Object?>[];
}

class BranchFormReady extends BranchFormState {
  const BranchFormReady({
    this.isSubmitting = false,
    this.isTogglingActive = false,
    this.fieldErrors = const <String, String>{},
  });

  final bool isSubmitting;
  final bool isTogglingActive;
  final Map<String, String> fieldErrors;

  bool get isBusy => isSubmitting || isTogglingActive;

  BranchFormReady copyWith({
    bool? isSubmitting,
    bool? isTogglingActive,
    Map<String, String>? fieldErrors,
  }) {
    return BranchFormReady(
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isTogglingActive: isTogglingActive ?? this.isTogglingActive,
      fieldErrors: fieldErrors ?? this.fieldErrors,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    isSubmitting,
    isTogglingActive,
    fieldErrors,
  ];
}

class BranchFormSubmitted extends BranchFormState {
  const BranchFormSubmitted({required this.branch, required this.wasCreated});

  final BranchEntity branch;
  final bool wasCreated;

  @override
  List<Object?> get props => <Object?>[branch, wasCreated];
}

class BranchFormActiveChanged extends BranchFormState {
  const BranchFormActiveChanged({required this.branch});

  final BranchEntity branch;

  @override
  List<Object?> get props => <Object?>[branch];
}

class BranchFormSubmitFailure extends BranchFormState {
  const BranchFormSubmitFailure({required this.errorMessage});

  final String errorMessage;

  @override
  List<Object?> get props => <Object?>[errorMessage];
}
