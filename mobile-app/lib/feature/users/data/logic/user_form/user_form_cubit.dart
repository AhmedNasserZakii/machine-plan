import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/users/data/logic/user_form/user_form_state.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/domain/params/user_form_params.dart';
import 'package:machinery/feature/users/domain/repos/users_repo.dart';

/// Backs both create and edit. [existing] being null is what makes it a
/// create — there is no separate mode flag to keep in sync.
class UserFormCubit extends Cubit<UserFormState> {
  UserFormCubit({required this.usersRepo, this.existing})
      : super(const UserFormLoading());

  final UsersRepo usersRepo;
  final UserEntity? existing;

  bool get isEditing => existing != null;

  Future<void> load() async {
    if (isClosed) {
      return;
    }

    emit(const UserFormLoading());

    final (
      Either<ServerFailure, List<RoleEntity>> rolesResult,
      Either<ServerFailure, List<BranchEntity>> branchesResult,
    ) = await (
      usersRepo.fetchRoles(),
      usersRepo.fetchBranches(),
    ).wait;

    if (isClosed) {
      return;
    }

    // Without roles there is no form to show: a role is required on create and
    // the picker would be empty.
    if (rolesResult.isLeft()) {
      final ServerFailure failure = rolesResult.swap().getOrElse(
            () => ServerFailure(''),
          );
      emit(
        UserFormLoadFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      );
      return;
    }

    final List<RoleEntity> roles = rolesResult.getOrElse(() => <RoleEntity>[]);
    final List<BranchEntity> branches = branchesResult.getOrElse(
      () => <BranchEntity>[],
    );

    emit(
      UserFormReady(
        roles: roles,
        branches: branches,
        selectedRole: _initialRole(roles),
        selectedBranchId: existing?.branchId,
      ),
    );
  }

  void selectRole(RoleEntity role) {
    final UserFormState current = state;
    if (current is! UserFormReady) {
      return;
    }

    // Moving to a company-level role drops the branch rather than sending one
    // the API would reject.
    emit(
      current.copyWith(
        selectedRole: role,
        clearBranch: !role.isBranchScoped,
        fieldErrors: const <String, String>{},
      ),
    );
  }

  void selectBranch(String branchId) {
    final UserFormState current = state;
    if (current is! UserFormReady) {
      return;
    }

    emit(current.copyWith(selectedBranchId: branchId));
  }

  Future<void> submit({
    required String fullName,
    required String phone,
    String? email,
    String? password,
  }) async {
    final UserFormState current = state;
    if (current is! UserFormReady || current.isSubmitting) {
      return;
    }

    final RoleEntity? role = current.selectedRole;
    if (role == null) {
      return;
    }

    emit(
      current.copyWith(
        isSubmitting: true,
        fieldErrors: const <String, String>{},
      ),
    );

    final String? branchId =
        role.isBranchScoped ? current.selectedBranchId : null;

    final Either<ServerFailure, UserEntity> result = isEditing
        ? await usersRepo.updateUser(
            id: existing!.id,
            params: UpdateUserParams(
              fullName: fullName,
              phone: phone,
              email: email,
              roleId: role.id,
              branchId: branchId,
              clearEmail: (email ?? '').trim().isEmpty,
              clearBranch: branchId == null,
            ),
          )
        : await usersRepo.createUser(
            params: CreateUserParams(
              fullName: fullName,
              phone: phone,
              email: email,
              roleId: role.id,
              branchId: branchId,
              password: password ?? '',
            ),
          );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) {
        // Field-level problems belong under the fields. Anything else is a
        // one-off message, announced and then dropped so the form returns to
        // an editable state with the user's input intact.
        if (failure.fieldErrors.isNotEmpty) {
          emit(
            current.copyWith(
              isSubmitting: false,
              fieldErrors: failure.fieldErrors,
            ),
          );
          return;
        }

        emit(UserFormSubmitFailure(errorMessage: failure.errorMessage));
        emit(current.copyWith(isSubmitting: false));
      },
      (UserEntity user) =>
          emit(UserFormSubmitted(user: user, wasCreated: !isEditing)),
    );
  }

  RoleEntity? _initialRole(List<RoleEntity> roles) {
    if (roles.isEmpty) {
      return null;
    }

    final String? existingRoleId = existing?.roleId;
    if (existingRoleId == null) {
      return null;
    }

    for (final RoleEntity role in roles) {
      if (role.id == existingRoleId) {
        return role;
      }
    }

    return null;
  }
}
