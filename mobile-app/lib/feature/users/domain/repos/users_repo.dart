import 'package:dartz/dartz.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';
import 'package:machinery/feature/users/domain/entities/permission_catalogue_entity.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_custody_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_permissions_entity.dart';
import 'package:machinery/feature/users/domain/params/role_write_params.dart';
import 'package:machinery/feature/users/domain/params/user_form_params.dart';
import 'package:machinery/feature/users/domain/params/users_query_params.dart';

/// One page of users plus the paging metadata the list needs to know whether
/// to keep scrolling.
class UsersPage {
  const UsersPage({required this.users, required this.meta});

  final List<UserEntity> users;
  final PaginationMetaModel meta;
}

/// User administration is deliberately online-only: nothing here is queued for
/// later. Creating an account offline would hand out credentials the server
/// has never heard of.
abstract class UsersRepo {
  Future<Either<ServerFailure, UsersPage>> fetchUsers({
    required UsersQueryParams params,
  });

  Future<Either<ServerFailure, UserEntity>> fetchUser({required String id});

  Future<Either<ServerFailure, UserCustodyEntity>> fetchUserCustody({
    required String id,
  });

  Future<Either<ServerFailure, UserEntity>> createUser({
    required CreateUserParams params,
  });

  Future<Either<ServerFailure, UserEntity>> updateUser({
    required String id,
    required UpdateUserParams params,
  });

  /// `isActive` decides which of the two endpoints is called.
  Future<Either<ServerFailure, Unit>> setUserActive({
    required String id,
    required bool isActive,
  });

  /// Returns nothing: the caller already knows the password it sent, and the
  /// server does not echo it back.
  Future<Either<ServerFailure, Unit>> resetPassword({
    required String id,
    required String newPassword,
  });

  Future<Either<ServerFailure, UserPermissionsEntity>> fetchUserPermissions({
    required String id,
  });

  /// Replaces the whole override set — anything absent from both lists goes
  /// back to being inherited from the role.
  Future<Either<ServerFailure, UserPermissionsEntity>> setUserPermissions({
    required String id,
    required List<String> allow,
    required List<String> deny,
  });

  Future<Either<ServerFailure, List<RoleEntity>>> fetchRoles({
    bool rawTranslations = false,
  });

  Future<Either<ServerFailure, RoleEntity>> createRole({
    required CreateRoleParams params,
  });

  Future<Either<ServerFailure, RoleEntity>> updateRole({
    required String id,
    required RoleTranslations translations,
  });

  Future<Either<ServerFailure, RoleEntity>> setRolePermissions({
    required String id,
    required List<String> permissions,
  });

  Future<Either<ServerFailure, List<PermissionGroupEntity>>>
      fetchPermissionCatalogue();

  Future<Either<ServerFailure, List<BranchEntity>>> fetchBranches();
}
