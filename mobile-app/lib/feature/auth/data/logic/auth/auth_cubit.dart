import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/services/sync/sync_coordinator.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_state.dart';
import 'package:machinery/feature/auth/domain/entities/auth_profile_entity.dart';
import 'package:machinery/feature/auth/domain/repos/auth_repo.dart';

/// The one singleton cubit in the app: session state is global.
///
/// It is also the only writer of `PermissionService`, which is what makes
/// navigation and every `PermissionGate` react to a permission change without
/// a restart.
class AuthCubit extends Cubit<AuthState> {
  AuthCubit({
    required this.authRepo,
    required this.permissionService,
    required this.syncCoordinator,
  }) : super(const AuthInitial());

  final AuthRepo authRepo;
  final PermissionService permissionService;
  final SyncCoordinator syncCoordinator;

  /// Splash flow. A network error here must not lock a representative out —
  /// it falls back to the cached profile and lets them in.
  Future<void> checkSession() async {
    if (isClosed) {
      return;
    }

    if (!await authRepo.hasStoredSession()) {
      if (!isClosed) {
        emit(const Unauthenticated());
      }
      return;
    }

    emit(const AuthChecking());

    final result = await authRepo.fetchProfile();

    if (isClosed) {
      return;
    }

    await result.fold(
      (failure) async {
        // The token interceptor already tried a refresh. A 401 here means the
        // session is genuinely gone.
        if (failure.isUnauthorized) {
          await authRepo.clearSession();
          await permissionService.clear();
          if (!isClosed) {
            emit(Unauthenticated(reason: failure.errorMessage));
          }
          return;
        }

        final AuthProfileEntity? cached = authRepo.readCachedProfile();
        if (cached == null) {
          if (!isClosed) {
            emit(Unauthenticated(reason: failure.errorMessage));
          }
          return;
        }

        await permissionService.update(cached.permissions);
        if (!isClosed) {
          emit(Authenticated(profile: cached, isFromCache: true));
        }
        // Splash landed on the cache because the profile fetch failed — most
        // often no connection at all, in which case this is a harmless no-op
        // (`flush` checks connectivity itself before doing anything).
        unawaited(syncCoordinator.flush());
      },
      (profile) async {
        await permissionService.update(profile.permissions);
        if (!isClosed) {
          emit(Authenticated(profile: profile));
        }
        unawaited(syncCoordinator.flush());
      },
    );
  }

  /// Called by `LoginCubit` once the repository has stored the tokens.
  Future<void> onAuthenticated(AuthProfileEntity profile) async {
    await permissionService.update(profile.permissions);
    if (!isClosed) {
      emit(Authenticated(profile: profile));
    }
    // The device has no local data yet — this is what turns into the very
    // first bootstrap (`SyncCoordinator.flush`, no cursor stored → bootstrap).
    unawaited(syncCoordinator.flush());
  }

  /// Silent refresh on app resume. The Director can grant finance access while
  /// the app is open, and the bottom bar has to grow to match.
  Future<void> refreshProfile() async {
    if (isClosed || state is! Authenticated) {
      return;
    }

    final result = await authRepo.fetchProfile();

    if (isClosed) {
      return;
    }

    await result.fold(
      // A failed background refresh keeps the current session as-is; the
      // interceptor handles a genuinely dead session.
      (_) async {},
      (profile) async {
        await permissionService.update(profile.permissions);
        if (!isClosed) {
          emit(Authenticated(profile: profile));
        }
      },
    );
  }

  /// Reflects a password change that the server says revoked other sessions.
  void onPasswordChanged() {
    final AuthState current = state;
    if (current is! Authenticated || isClosed) {
      return;
    }

    emit(
      Authenticated(
        profile: AuthProfileEntity(
          user: current.profile.user.copyWith(mustChangePassword: false),
          permissions: current.profile.permissions,
        ),
      ),
    );
  }

  Future<ServerFailure?> logout() async {
    final result = await authRepo.logout();

    await permissionService.clear();

    if (!isClosed) {
      emit(const Unauthenticated());
    }

    return result.fold((failure) => failure, (_) => null);
  }
}
