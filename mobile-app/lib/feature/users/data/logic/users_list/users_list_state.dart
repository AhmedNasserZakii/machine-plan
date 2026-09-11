import 'package:equatable/equatable.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/domain/params/users_query_params.dart';

abstract class UsersListState extends Equatable {
  const UsersListState();

  @override
  List<Object?> get props => <Object?>[];
}

class UsersListInitial extends UsersListState {
  const UsersListInitial();
}

class UsersListLoading extends UsersListState {
  const UsersListLoading();
}

/// The only state the list screen renders from. Paging, filtering and the
/// filter-sheet lookups all live here so a refresh never loses the filters
/// the user picked.
class UsersListLoaded extends UsersListState {
  const UsersListLoaded({
    required this.users,
    required this.query,
    required this.hasNext,
    this.roles = const <RoleEntity>[],
    this.branches = const <BranchEntity>[],
    this.isLoadingMore = false,
    this.total = 0,
  });

  final List<UserEntity> users;
  final UsersQueryParams query;
  final bool hasNext;
  final bool isLoadingMore;
  final int total;

  /// Loaded once alongside the first page, for the filter sheet and so the
  /// list can show a role name without a second call per row.
  final List<RoleEntity> roles;
  final List<BranchEntity> branches;

  UsersListLoaded copyWith({
    List<UserEntity>? users,
    UsersQueryParams? query,
    bool? hasNext,
    bool? isLoadingMore,
    int? total,
    List<RoleEntity>? roles,
    List<BranchEntity>? branches,
  }) {
    return UsersListLoaded(
      users: users ?? this.users,
      query: query ?? this.query,
      hasNext: hasNext ?? this.hasNext,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      total: total ?? this.total,
      roles: roles ?? this.roles,
      branches: branches ?? this.branches,
    );
  }

  @override
  List<Object?> get props => <Object?>[
        users,
        query,
        hasNext,
        isLoadingMore,
        total,
        roles,
        branches,
      ];
}

class UsersListFailure extends UsersListState {
  const UsersListFailure({required this.errorMessage, this.isOffline = false});

  final String errorMessage;

  /// Drives the "this screen needs a connection" state rather than a generic
  /// error, because user administration is never queued.
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
