import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfers_query_params.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo.dart';
import 'package:machinery/feature/users/domain/entities/user_custody_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/domain/repos/users_repo.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/repos/violations_repo.dart';

sealed class UserDetailState extends Equatable {
  const UserDetailState();
  @override
  List<Object?> get props => const <Object?>[];
}

class UserDetailLoading extends UserDetailState {
  const UserDetailLoading();
}

class UserDetailFailure extends UserDetailState {
  const UserDetailFailure(this.message, {this.isOffline = false});
  final String message;
  final bool isOffline;
  @override
  List<Object?> get props => <Object?>[message, isOffline];
}

class UserDetailLoaded extends UserDetailState {
  const UserDetailLoaded({
    required this.user,
    this.custody,
    this.violations,
    this.activity = const <TransferEntity>[],
  });
  final UserEntity user;
  final UserCustodyEntity? custody;
  final ViolationSummary? violations;
  final List<TransferEntity> activity;
  @override
  List<Object?> get props => <Object?>[user, custody, violations, activity];
}

class UserDetailCubit extends Cubit<UserDetailState> {
  UserDetailCubit({
    required this.userId,
    required this.usersRepo,
    required this.violationsRepo,
    required this.transfersRepo,
    required this.permissions,
    this.initial,
  }) : super(const UserDetailLoading());

  final String userId;
  final UsersRepo usersRepo;
  final ViolationsRepo violationsRepo;
  final TransfersRepo transfersRepo;
  final PermissionService permissions;
  final UserEntity? initial;

  Future<void> load() async {
    emit(const UserDetailLoading());
    final userResult = await usersRepo.fetchUser(id: userId);
    if (isClosed) return;
    final failure = userResult.swap().toOption().toNullable();
    if (failure != null) {
      emit(
        UserDetailFailure(
          failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      );
      return;
    }
    final fetched = userResult.toOption().toNullable()!;
    final user = fetched.branchName == null && initial?.branchId == fetched.branchId
        ? fetched.copyWith(branchName: initial?.branchName)
        : fetched;

    final custodyFuture = permissions.has(P.machinesRead)
        ? usersRepo.fetchUserCustody(id: userId)
        : Future.value(
            left<ServerFailure, UserCustodyEntity>(ServerFailure('hidden')),
          );
    final violationsFuture = permissions.has(P.violationsRead)
        ? violationsRepo.fetchSummary(userId: userId)
        : Future.value(
            left<ServerFailure, ViolationSummary>(ServerFailure('hidden')),
          );
    final activityFuture = permissions.has(P.transfersRead)
        ? _activity()
        : Future.value(<TransferEntity>[]);
    final (custodyResult, violationsResult, activity) = await (
      custodyFuture,
      violationsFuture,
      activityFuture,
    ).wait;
    if (isClosed) return;
    emit(
      UserDetailLoaded(
        user: user,
        custody: custodyResult.toOption().toNullable(),
        violations: violationsResult.toOption().toNullable(),
        activity: activity,
      ),
    );
  }

  Future<List<TransferEntity>> _activity() async {
    final results = await (
      transfersRepo.fetchTransfers(
        params: TransfersQueryParams(limit: 5, fromPartyId: userId),
      ),
      transfersRepo.fetchTransfers(
        params: TransfersQueryParams(limit: 5, toPartyId: userId),
      ),
    ).wait;
    final rows = <String, TransferEntity>{};
    for (final result in <Either<ServerFailure, TransfersPage>>[
      results.$1,
      results.$2,
    ]) {
      for (final transfer
          in result.toOption().toNullable()?.transfers ??
              const <TransferEntity>[]) {
        rows[transfer.id] = transfer;
      }
    }
    final sorted = rows.values.toList()
      ..sort((a, b) => b.occurredAt.compareTo(a.occurredAt));
    return sorted.take(5).toList(growable: false);
  }
}
