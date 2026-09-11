import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/users/domain/entities/permission_catalogue_entity.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/domain/params/role_write_params.dart';
import 'package:machinery/feature/users/domain/params/users_query_params.dart';
import 'package:machinery/feature/users/domain/repos/users_repo.dart';

sealed class RolesState extends Equatable {
  const RolesState();
  @override
  List<Object?> get props => const <Object?>[];
}

class RolesLoading extends RolesState {
  const RolesLoading();
}

class RolesFailure extends RolesState {
  const RolesFailure(this.message, {this.isOffline = false});
  final String message;
  final bool isOffline;
  @override
  List<Object?> get props => <Object?>[message, isOffline];
}

class RolesReady extends RolesState {
  const RolesReady({
    required this.roles,
    required this.groups,
    this.isSaving = false,
    this.message,
    this.error,
  });
  final List<RoleEntity> roles;
  final List<PermissionGroupEntity> groups;
  final bool isSaving;
  final String? message;
  final String? error;
  RolesReady copyWith({
    List<RoleEntity>? roles,
    List<PermissionGroupEntity>? groups,
    bool? isSaving,
    String? message,
    String? error,
  }) =>
      RolesReady(
        roles: roles ?? this.roles,
        groups: groups ?? this.groups,
        isSaving: isSaving ?? this.isSaving,
        message: message,
        error: error,
      );
  @override
  List<Object?> get props => <Object?>[
        roles,
        groups,
        isSaving,
        message,
        error,
      ];
}

class RolesCubit extends Cubit<RolesState> {
  RolesCubit({required this.repo}) : super(const RolesLoading());
  final UsersRepo repo;

  Future<void> load() async {
    emit(const RolesLoading());
    final (rolesResult, groupsResult) = await (
      repo.fetchRoles(rawTranslations: true),
      repo.fetchPermissionCatalogue(),
    ).wait;
    if (isClosed) return;
    final failure = rolesResult.swap().toOption().toNullable() ??
        groupsResult.swap().toOption().toNullable();
    if (failure != null) {
      emit(RolesFailure(failure.errorMessage,
          isOffline: failure is OfflineFailure));
      return;
    }
    emit(
      RolesReady(
        roles: rolesResult.toOption().toNullable()!,
        groups: groupsResult.toOption().toNullable()!,
      ),
    );
  }

  Future<int> affectedUsers(String roleId) async {
    final result = await repo.fetchUsers(
      params: UsersQueryParams(roleId: roleId, limit: 1),
    );
    return result.toOption().toNullable()?.meta.total ?? 0;
  }

  Future<bool> create(CreateRoleParams params) => _save(
        () => repo.createRole(params: params),
      );

  Future<bool> rename(String id, RoleTranslations translations) => _save(
        () => repo.updateRole(id: id, translations: translations),
      );

  Future<bool> setPermissions(String id, Set<String> permissions) => _save(
        () => repo.setRolePermissions(
          id: id,
          permissions: permissions.toList()..sort(),
        ),
      );

  Future<bool> _save(
    Future<Either<ServerFailure, RoleEntity>> Function() operation,
  ) async {
    final current = state;
    if (current is! RolesReady || current.isSaving) return false;
    emit(current.copyWith(isSaving: true));
    final result = await operation();
    if (isClosed) return false;
    final failure = result.swap().toOption().toNullable();
    if (failure != null) {
      emit(current.copyWith(error: failure.errorMessage));
      return false;
    }
    await load();
    return true;
  }
}
