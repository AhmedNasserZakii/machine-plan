import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/feature/auth/data/models/auth_profile_response_model.dart';
import 'package:machinery/feature/auth/data/models/auth_session_response_model.dart';
import 'package:machinery/feature/auth/data/models/change_password_model.dart';
import 'package:machinery/feature/auth/data/models/login_model.dart';
import 'package:machinery/feature/auth/domain/entities/auth_profile_entity.dart';
import 'package:machinery/feature/auth/domain/entities/auth_session_entity.dart';
import 'package:machinery/feature/auth/domain/params/change_password_params.dart';
import 'package:machinery/feature/auth/domain/params/login_params.dart';
import 'package:machinery/feature/auth/domain/repos/auth_repo.dart';

class AuthRepoImpl implements AuthRepo {
  AuthRepoImpl({required this.networkInfo});

  final NetworkInfo networkInfo;

  @override
  Future<Either<ServerFailure, AuthSessionEntity>> login({
    required LoginParams params,
  }) async {
    try {
      if (!await networkInfo.isConnected) {
        // There is no offline password check by design. Every later launch
        // works offline from the cached profile, but the first one needs a
        // network.
        return Left(OfflineFailure(LocaleKeys.firstLoginNeedsInternet.tr()));
      }

      final Response<dynamic> response = await apiService
          .client(requireAuth: false)
          .post<dynamic>(
            WebConstant.login,
            data: LoginModel.fromParams(params).toJson(),
          );

      final Map<String, dynamic>? data = _dataOf(response.data);
      if (data == null) {
        return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
      }

      final AuthSessionResponseModel session =
          AuthSessionResponseModel.fromDataJson(data);

      if (session.accessToken.isEmpty) {
        return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
      }

      await _persistTokens(session);

      // Login returns tokens only. The profile and the permission list — which
      // gate every screen — come from /auth/me, which stays reachable even
      // while a password change is pending.
      final Either<ServerFailure, AuthProfileEntity> result =
          await fetchProfile();
      final AuthProfileEntity? profile = result.fold((_) => null, (p) => p);

      if (profile == null) {
        // Half a session is worse than none: without permissions the app would
        // render an empty shell. Drop the tokens and report the failure.
        await clearSession();
        return Left(
          result.fold(
            (ServerFailure failure) => failure,
            (_) => ServerFailure(LocaleKeys.anErrorOccurred.tr()),
          ),
        );
      }

      return Right(
        AuthSessionEntity(
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          profile: profile,
        ),
      );
    } on DioException catch (error, stackTrace) {
      printDebug(
        message: 'auth repo login dio exception: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'auth repo login catch: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
    }
  }

  @override
  Future<Either<ServerFailure, AuthProfileEntity>> fetchProfile() async {
    try {
      if (!await networkInfo.isConnected) {
        return Left(OfflineFailure());
      }

      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.me,
      );

      final Map<String, dynamic>? data = _dataOf(response.data);
      if (data == null) {
        return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
      }

      final AuthProfileResponseModel profile =
          AuthProfileResponseModel.fromDataJson(data);

      await _persistProfile(profile);

      return Right(profile.toEntity());
    } on DioException catch (error, stackTrace) {
      printDebug(
        message: 'auth repo fetchProfile dio exception: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'auth repo fetchProfile catch: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
    }
  }

  @override
  Future<Either<ServerFailure, Unit>> changePassword({
    required ChangePasswordParams params,
  }) async {
    try {
      if (!await networkInfo.isConnected) {
        return Left(OfflineFailure());
      }

      await apiService.client().post<dynamic>(
        WebConstant.changePassword,
        data: ChangePasswordModel.fromParams(params).toJson(),
      );

      return const Right(unit);
    } on DioException catch (error, stackTrace) {
      printDebug(
        message: 'auth repo changePassword dio exception: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'auth repo changePassword catch: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
    }
  }

  @override
  Future<Either<ServerFailure, Unit>> logout() async {
    try {
      final String refreshToken = await LocalStorage.getRefreshToken();

      if (refreshToken.isNotEmpty && await networkInfo.isConnected) {
        // Best effort: revoking the refresh token server-side must not block a
        // user who wants out while offline. The endpoint requires the token in
        // the body — that is the row it revokes.
        await apiService.client().post<dynamic>(
          WebConstant.logout,
          data: <String, dynamic>{ApiKeys.refreshToken: refreshToken},
        );
      }
      return const Right(unit);
    } on DioException catch (error, stackTrace) {
      printDebug(
        message: 'auth repo logout dio exception: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'auth repo logout catch: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
    } finally {
      await clearSession();
    }
  }

  @override
  AuthProfileEntity? readCachedProfile() {
    final Map<String, dynamic>? cached = LocalStorage.getCachedAuthUser();
    if (cached == null) {
      return null;
    }

    try {
      return AuthProfileResponseModel.fromDataJson(cached).toEntity();
    } catch (error, stackTrace) {
      printDebug(
        message: 'auth repo readCachedProfile catch: ${error.toString()}',
        stackTrace: stackTrace,
      );
      return null;
    }
  }

  @override
  Future<bool> hasStoredSession() async {
    return (await LocalStorage.getAccessToken()).trim().isNotEmpty;
  }

  @override
  Future<void> clearSession() => LocalStorage.clearSession();

  // ── Helpers ──────────────────────────────────────────────────────────────

  Map<String, dynamic>? _dataOf(dynamic body) {
    if (body is! Map<String, dynamic>) {
      return null;
    }
    final dynamic data = body[ApiKeys.data];
    return data is Map<String, dynamic> ? data : null;
  }

  Future<void> _persistTokens(AuthSessionResponseModel session) async {
    await LocalStorage.setAccessToken(session.accessToken);
    if (session.refreshToken.isNotEmpty) {
      await LocalStorage.setRefreshToken(session.refreshToken);
    }
  }

  Future<void> _persistProfile(AuthProfileResponseModel profile) async {
    await LocalStorage.setCachedAuthUser(profile.toJson());
    await LocalStorage.setCachedPermissions(profile.permissions);
  }
}
