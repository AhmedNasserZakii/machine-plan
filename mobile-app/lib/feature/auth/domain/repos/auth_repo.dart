import 'package:dartz/dartz.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/auth/domain/entities/auth_profile_entity.dart';
import 'package:machinery/feature/auth/domain/entities/auth_session_entity.dart';
import 'package:machinery/feature/auth/domain/params/change_password_params.dart';
import 'package:machinery/feature/auth/domain/params/login_params.dart';

abstract class AuthRepo {
  Future<Either<ServerFailure, AuthSessionEntity>> login({
    required LoginParams params,
  });

  /// `/auth/me`. Refreshes the cached user and permission list.
  Future<Either<ServerFailure, AuthProfileEntity>> fetchProfile();

  Future<Either<ServerFailure, Unit>> changePassword({
    required ChangePasswordParams params,
  });

  Future<Either<ServerFailure, Unit>> logout();

  /// The last known profile, straight from local storage. Returns null when
  /// there has never been a successful login on this device.
  AuthProfileEntity? readCachedProfile();

  Future<bool> hasStoredSession();

  /// Clears tokens and the cached profile. Deliberately leaves the sync queue
  /// alone — unsent work is not the session's to discard.
  Future<void> clearSession();
}
