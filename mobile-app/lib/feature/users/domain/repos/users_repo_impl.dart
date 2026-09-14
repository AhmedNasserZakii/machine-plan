import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/core/network_services/paginated_fetch.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/feature/users/data/models/branch_model.dart';
import 'package:machinery/feature/users/data/models/permission_group_model.dart';
import 'package:machinery/feature/users/data/models/role_model.dart';
import 'package:machinery/feature/users/data/models/user_model.dart';
import 'package:machinery/feature/users/data/models/user_custody_model.dart';
import 'package:machinery/feature/users/data/models/user_permissions_model.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';
import 'package:machinery/feature/users/domain/entities/permission_catalogue_entity.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_custody_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_permissions_entity.dart';
import 'package:machinery/feature/users/domain/params/user_form_params.dart';
import 'package:machinery/feature/users/domain/params/role_write_params.dart';
import 'package:machinery/feature/users/domain/params/users_query_params.dart';
import 'package:machinery/feature/users/domain/repos/users_repo.dart';

class UsersRepoImpl implements UsersRepo {
  UsersRepoImpl({required this.apiService, required this.networkInfo});

  final ApiService apiService;
  final NetworkInfo networkInfo;

  @override
  Future<Either<ServerFailure, UsersPage>> fetchUsers({
    required UsersQueryParams params,
  }) {
    return _guard('fetchUsers', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
            WebConstant.users,
            queryParameters: params.toQuery(),
          );

      final Map<String, dynamic> body = _body(response.data);

      return UsersPage(
        users: _list(body[ApiKeys.data])
            .map(
              (Map<String, dynamic> json) =>
                  UserModel.fromJson(json).toEntity(),
            )
            .toList(growable: false),
        meta: _metaOf(body),
      );
    });
  }

  @override
  Future<Either<ServerFailure, UserEntity>> fetchUser({required String id}) {
    return _guard('fetchUser', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
            WebConstant.user(id),
          );

      return UserModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, UserCustodyEntity>> fetchUserCustody({
    required String id,
    int page = 1,
  }) =>
      _guard('fetchUserCustody', () async {
        final response = await apiService.client().get<dynamic>(
              WebConstant.userCustody(id),
              queryParameters: <String, dynamic>{
                ApiKeys.page: page,
                ApiKeys.limit: 20,
              },
            );
        return userCustodyFromJson(_data(response.data));
      });

  @override
  Future<Either<ServerFailure, UserEntity>> createUser({
    required CreateUserParams params,
  }) {
    return _guard('createUser', () async {
      final Response<dynamic> response = await apiService
          .client()
          .post<dynamic>(WebConstant.users, data: params.toJson());

      return UserModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, UserEntity>> updateUser({
    required String id,
    required UpdateUserParams params,
  }) {
    return _guard('updateUser', () async {
      final Response<dynamic> response = await apiService
          .client()
          .patch<dynamic>(WebConstant.user(id), data: params.toJson());

      return UserModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, Unit>> setUserActive({
    required String id,
    required bool isActive,
  }) {
    return _guard('setUserActive', () async {
      await apiService.client().patch<dynamic>(
            isActive
                ? WebConstant.userActivate(id)
                : WebConstant.userDeactivate(id),
          );

      return unit;
    });
  }

  @override
  Future<Either<ServerFailure, Unit>> resetPassword({
    required String id,
    required String newPassword,
  }) {
    return _guard('resetPassword', () async {
      await apiService.client().post<dynamic>(
        WebConstant.userResetPassword(id),
        data: <String, dynamic>{ApiKeys.newPassword: newPassword},
      );

      return unit;
    });
  }

  @override
  Future<Either<ServerFailure, UserPermissionsEntity>> fetchUserPermissions({
    required String id,
  }) {
    return _guard('fetchUserPermissions', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
            WebConstant.userPermissions(id),
          );

      return UserPermissionsModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, UserPermissionsEntity>> setUserPermissions({
    required String id,
    required List<String> allow,
    required List<String> deny,
  }) {
    return _guard('setUserPermissions', () async {
      final Response<dynamic> response = await apiService.client().put<dynamic>(
        WebConstant.userPermissions(id),
        data: <String, dynamic>{ApiKeys.allow: allow, ApiKeys.deny: deny},
      );

      return UserPermissionsModel.fromJson(_data(response.data)).toEntity();
    });
  }

  @override
  Future<Either<ServerFailure, List<RoleEntity>>> fetchRoles({
    bool rawTranslations = false,
  }) {
    return _guard('fetchRoles', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
            WebConstant.roles,
            queryParameters: rawTranslations
                ? const <String, dynamic>{'raw_translations': 'true'}
                : null,
          );

      return _list(_body(response.data)[ApiKeys.data])
          .map(
            (Map<String, dynamic> json) => RoleModel.fromJson(json).toEntity(),
          )
          .toList(growable: false);
    });
  }

  @override
  Future<Either<ServerFailure, RoleEntity>> createRole({
    required CreateRoleParams params,
  }) =>
      _guard('createRole', () async {
        final response = await apiService.client().post<dynamic>(
              WebConstant.roles,
              data: params.toJson(),
            );
        return RoleModel.fromJson(_data(response.data)).toEntity();
      });

  @override
  Future<Either<ServerFailure, RoleEntity>> updateRole({
    required String id,
    required RoleTranslations translations,
  }) =>
      _guard('updateRole', () async {
        final response = await apiService.client().patch<dynamic>(
          WebConstant.role(id),
          data: <String, dynamic>{'translations': translations.toJson()},
        );
        return RoleModel.fromJson(_data(response.data)).toEntity();
      });

  @override
  Future<Either<ServerFailure, RoleEntity>> setRolePermissions({
    required String id,
    required List<String> permissions,
  }) =>
      _guard('setRolePermissions', () async {
        final response = await apiService.client().put<dynamic>(
          WebConstant.rolePermissions(id),
          data: <String, dynamic>{'permissions': permissions},
        );
        return RoleModel.fromJson(_data(response.data)).toEntity();
      });

  @override
  Future<Either<ServerFailure, List<PermissionGroupEntity>>>
      fetchPermissionCatalogue() {
    return _guard('fetchPermissionCatalogue', () async {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
            WebConstant.permissions,
          );

      return _list(_body(response.data)[ApiKeys.data])
          .map(
            (Map<String, dynamic> json) =>
                PermissionGroupModel.fromJson(json).toEntity(),
          )
          .toList(growable: false);
    });
  }

  @override
  Future<Either<ServerFailure, List<BranchEntity>>> fetchBranches() {
    return _guard('fetchBranches', () async {
      final List<Map<String, dynamic>> rows = await PaginatedFetch.all(
        client: apiService.client(),
        path: WebConstant.branches,
      );

      return rows
          .map(
            (Map<String, dynamic> json) =>
                BranchModel.fromJson(json).toEntity(),
          )
          .toList(growable: false);
    });
  }

  /// Every call shares the same shape: refuse offline, run, translate the two
  /// failure modes. Repeating this per method is how one of them ends up
  /// swallowing an exception.
  Future<Either<ServerFailure, T>> _guard<T>(
    String label,
    Future<T> Function() run,
  ) async {
    try {
      if (!await networkInfo.isConnected) {
        return Left(OfflineFailure());
      }

      return Right(await run());
    } on PaginatedFetchCapException catch (error, stackTrace) {
      printDebug(
        message: 'users repo $label page cap: $error',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.paginationListTooLarge.tr()));
    } on DioException catch (error, stackTrace) {
      printDebug(
        message: 'users repo $label dio exception: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'users repo $label catch: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
    }
  }

  static Map<String, dynamic> _body(dynamic raw) {
    return raw is Map<String, dynamic> ? raw : const <String, dynamic>{};
  }

  static Map<String, dynamic> _data(dynamic raw) {
    final dynamic data = _body(raw)[ApiKeys.data];
    return data is Map<String, dynamic> ? data : const <String, dynamic>{};
  }

  /// `GET /users` returns `data` as a bare array with the paging in `meta`,
  /// but some list endpoints wrap it as `data.items`. Accept both.
  static List<Map<String, dynamic>> _list(dynamic raw) {
    if (raw is List) {
      return raw.whereType<Map<String, dynamic>>().toList(growable: false);
    }

    if (raw is Map<String, dynamic> && raw[ApiKeys.items] is List) {
      return (raw[ApiKeys.items] as List)
          .whereType<Map<String, dynamic>>()
          .toList(growable: false);
    }

    return const <Map<String, dynamic>>[];
  }

  static PaginationMetaModel _metaOf(Map<String, dynamic> body) {
    final dynamic meta = body[ApiKeys.meta];
    if (meta is Map<String, dynamic>) {
      return PaginationMetaModel.fromJson(meta);
    }

    final dynamic data = body[ApiKeys.data];
    if (data is Map<String, dynamic> &&
        data[ApiKeys.meta] is Map<String, dynamic>) {
      return PaginationMetaModel.fromJson(
        data[ApiKeys.meta] as Map<String, dynamic>,
      );
    }

    return PaginationMetaModel.empty;
  }
}
