import 'package:equatable/equatable.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';

abstract class UserFormState extends Equatable {
  const UserFormState();

  @override
  List<Object?> get props => <Object?>[];
}

class UserFormLoading extends UserFormState {
  const UserFormLoading();
}

/// The form is usable. [selectedRole] drives whether a branch is even asked
/// for, so it is held as the resolved role rather than a bare id.
class UserFormReady extends UserFormState {
  const UserFormReady({
    required this.roles,
    required this.branches,
    this.selectedRole,
    this.selectedBranchId,
    this.isSubmitting = false,
    this.fieldErrors = const <String, String>{},
  });

  final List<RoleEntity> roles;
  final List<BranchEntity> branches;
  final RoleEntity? selectedRole;
  final String? selectedBranchId;
  final bool isSubmitting;

  /// Server-side 400 details, rendered under the matching field.
  final Map<String, String> fieldErrors;

  bool get requiresBranch => selectedRole?.isBranchScoped ?? false;

  UserFormReady copyWith({
    List<RoleEntity>? roles,
    List<BranchEntity>? branches,
    RoleEntity? selectedRole,
    String? selectedBranchId,
    bool? isSubmitting,
    Map<String, String>? fieldErrors,
    bool clearBranch = false,
  }) {
    return UserFormReady(
      roles: roles ?? this.roles,
      branches: branches ?? this.branches,
      selectedRole: selectedRole ?? this.selectedRole,
      selectedBranchId:
          clearBranch ? null : (selectedBranchId ?? this.selectedBranchId),
      isSubmitting: isSubmitting ?? this.isSubmitting,
      fieldErrors: fieldErrors ?? this.fieldErrors,
    );
  }

  @override
  List<Object?> get props => <Object?>[
        roles,
        branches,
        selectedRole,
        selectedBranchId,
        isSubmitting,
        fieldErrors,
      ];
}

class UserFormLoadFailure extends UserFormState {
  const UserFormLoadFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}

/// Emitted once on success so the screen can pop and the list can refresh.
class UserFormSubmitted extends UserFormState {
  const UserFormSubmitted({required this.user, required this.wasCreated});

  final UserEntity user;
  final bool wasCreated;

  @override
  List<Object?> get props => <Object?>[user, wasCreated];
}

class UserFormSubmitFailure extends UserFormState {
  const UserFormSubmitFailure({required this.errorMessage});

  final String errorMessage;

  @override
  List<Object?> get props => <Object?>[errorMessage];
}
