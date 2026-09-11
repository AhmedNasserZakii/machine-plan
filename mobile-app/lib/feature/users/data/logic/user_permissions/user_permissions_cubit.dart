import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/users/data/logic/user_permissions/user_permissions_state.dart';
import 'package:machinery/feature/users/domain/entities/permission_catalogue_entity.dart';
import 'package:machinery/feature/users/domain/entities/permission_draft.dart';
import 'package:machinery/feature/users/domain/entities/user_permissions_entity.dart';
import 'package:machinery/feature/users/domain/repos/users_repo.dart';

class UserPermissionsCubit extends Cubit<UserPermissionsState> {
  UserPermissionsCubit({required this.usersRepo, required this.userId})
      : super(const UserPermissionsLoading());

  final UsersRepo usersRepo;
  final String userId;

  Future<void> load() async {
    if (isClosed) {
      return;
    }

    emit(const UserPermissionsLoading());

    final (
      Either<ServerFailure, List<PermissionGroupEntity>> catalogueResult,
      Either<ServerFailure, UserPermissionsEntity> permissionsResult,
    ) = await (
      usersRepo.fetchPermissionCatalogue(),
      usersRepo.fetchUserPermissions(id: userId),
    ).wait;

    if (isClosed) {
      return;
    }

    // Either half missing makes the screen a lie: without the catalogue there
    // is nothing to list, and without the overrides every row would read as
    // inherited.
    final ServerFailure? failure =
        catalogueResult.swap().toOption().toNullable() ??
            permissionsResult.swap().toOption().toNullable();

    if (failure != null) {
      emit(
        UserPermissionsLoadFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      );
      return;
    }

    emit(
      UserPermissionsReady(
        groups: catalogueResult.getOrElse(() => <PermissionGroupEntity>[]),
        draft: PermissionDraft.from(
          permissionsResult.getOrElse(
            () => const UserPermissionsEntity(
              userId: '',
              rolePermissions: <String>{},
              overrides: <String, PermissionEffect>{},
              effectivePermissions: <String>{},
            ),
          ),
        ),
      ),
    );
  }

  void toggle(String code) {
    final UserPermissionsState current = state;
    if (current is! UserPermissionsReady || current.isSaving) {
      return;
    }

    emit(current.copyWith(draft: current.draft.cycle(code)));
  }

  void toggleGroup(String group) {
    final UserPermissionsState current = state;
    if (current is! UserPermissionsReady) {
      return;
    }

    final Set<String> expanded = <String>{...current.expandedGroups};
    if (!expanded.remove(group)) {
      expanded.add(group);
    }

    emit(current.copyWith(expandedGroups: expanded));
  }

  void search(String term) {
    final UserPermissionsState current = state;
    if (current is! UserPermissionsReady) {
      return;
    }

    emit(current.copyWith(searchTerm: term));
  }

  void discardChanges() {
    final UserPermissionsState current = state;
    if (current is! UserPermissionsReady) {
      return;
    }

    emit(current.copyWith(draft: current.draft.reset()));
  }

  Future<void> save() async {
    final UserPermissionsState current = state;
    if (current is! UserPermissionsReady ||
        current.isSaving ||
        !current.hasChanges) {
      return;
    }

    emit(current.copyWith(isSaving: true));

    final Either<ServerFailure, UserPermissionsEntity> result =
        await usersRepo.setUserPermissions(
      id: userId,
      allow: current.draft.allowList,
      deny: current.draft.denyList,
    );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) {
        emit(UserPermissionsSaveFailure(errorMessage: failure.errorMessage));
        emit(current.copyWith(isSaving: false));
      },
      (UserPermissionsEntity saved) {
        emit(const UserPermissionsSaved());
        // Rebase on what the server actually stored, so the screen reflects
        // the saved truth rather than the draft that was sent.
        emit(
          current.copyWith(draft: PermissionDraft.from(saved), isSaving: false),
        );
      },
    );
  }
}
