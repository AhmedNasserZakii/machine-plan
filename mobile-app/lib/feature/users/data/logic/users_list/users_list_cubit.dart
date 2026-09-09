import 'dart:async';

import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/users/data/logic/users_list/users_list_state.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';
import 'package:machinery/feature/users/domain/entities/role_entity.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/domain/params/users_query_params.dart';
import 'package:machinery/feature/users/domain/repos/users_repo.dart';

class UsersListCubit extends Cubit<UsersListState> {
  UsersListCubit({required this.usersRepo}) : super(const UsersListInitial());

  final UsersRepo usersRepo;

  /// Typing in the search box must not fire a request per keystroke.
  static const Duration searchDebounce = Duration(milliseconds: 350);

  Timer? _searchTimer;

  List<RoleEntity> _roles = const <RoleEntity>[];
  List<BranchEntity> _branches = const <BranchEntity>[];

  @override
  Future<void> close() {
    _searchTimer?.cancel();
    return super.close();
  }

  /// First load, and the pull-to-refresh path. Keeps whatever filters are
  /// already applied unless [params] overrides them.
  Future<void> load({UsersQueryParams? params, bool showLoader = true}) async {
    if (isClosed) {
      return;
    }

    final UsersQueryParams query = (params ?? _currentQuery).copyWith(page: 1);

    if (showLoader) {
      emit(const UsersListLoading());
    }

    // The lookups only need fetching once; a refresh should not re-pull them.
    await _ensureLookups();

    final result = await usersRepo.fetchUsers(params: query);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        UsersListFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (UsersPage page) => emit(
        UsersListLoaded(
          users: _withBranchNames(page.users),
          query: query,
          hasNext: page.meta.hasNext,
          total: page.meta.total,
          roles: _roles,
          branches: _branches,
        ),
      ),
    );
  }

  Future<void> loadMore() async {
    final UsersListState current = state;

    if (current is! UsersListLoaded ||
        current.isLoadingMore ||
        !current.hasNext) {
      return;
    }

    emit(current.copyWith(isLoadingMore: true));

    final UsersQueryParams next = current.query.copyWith(
      page: current.query.page + 1,
    );

    final result = await usersRepo.fetchUsers(params: next);

    if (isClosed) {
      return;
    }

    result.fold(
      // A failed page must not wipe the pages already on screen.
      (ServerFailure _) => emit(current.copyWith(isLoadingMore: false)),
      (UsersPage page) => emit(
        current.copyWith(
          users: <UserEntity>[
            ...current.users,
            ..._withBranchNames(page.users),
          ],
          query: next,
          hasNext: page.meta.hasNext,
          total: page.meta.total,
          isLoadingMore: false,
        ),
      ),
    );
  }

  void search(String term) {
    _searchTimer?.cancel();
    _searchTimer = Timer(searchDebounce, () {
      final String trimmed = term.trim();
      load(
        params: trimmed.isEmpty
            ? _currentQuery.copyWith(resetSearch: true)
            : _currentQuery.copyWith(search: trimmed),
        showLoader: false,
      );
    });
  }

  Future<void> applyFilters({
    String? roleId,
    String? branchId,
    bool? isActive,
    bool clearRole = false,
    bool clearBranch = false,
    bool clearActive = false,
  }) {
    return load(
      params: _currentQuery.copyWith(
        roleId: roleId,
        branchId: branchId,
        isActive: isActive,
        resetRole: clearRole,
        resetBranch: clearBranch,
        resetActive: clearActive,
      ),
      showLoader: false,
    );
  }

  Future<void> clearFilters() {
    return load(
      params: _currentQuery.copyWith(
        resetRole: true,
        resetBranch: true,
        resetActive: true,
      ),
      showLoader: false,
    );
  }

  /// Swaps one row in place after an edit, so returning from the form does not
  /// scroll the list back to the top.
  void replaceUser(UserEntity updated) {
    final UsersListState current = state;
    if (current is! UsersListLoaded) {
      return;
    }

    final List<UserEntity> users = current.users
        .map((UserEntity user) => user.id == updated.id ? updated : user)
        .toList(growable: false);

    emit(current.copyWith(users: users));
  }

  UsersQueryParams get _currentQuery {
    final UsersListState current = state;
    return current is UsersListLoaded
        ? current.query
        : const UsersQueryParams();
  }

  /// `GET /users` returns a branch id but no branch name, so a row would
  /// otherwise say which role someone holds without saying where — which is
  /// half the answer when two branches have the same job titles.
  List<UserEntity> _withBranchNames(List<UserEntity> users) {
    if (_branches.isEmpty) {
      return users;
    }

    final Map<String, String> namesById = <String, String>{
      for (final BranchEntity branch in _branches) branch.id: branch.name,
    };

    return users
        .map(
          (UserEntity user) => user.branchId == null
              ? user
              : user.copyWith(branchName: namesById[user.branchId]),
        )
        .toList(growable: false);
  }

  Future<void> _ensureLookups() async {
    if (_roles.isNotEmpty) {
      return;
    }

    final (
      Either<ServerFailure, List<RoleEntity>> roles,
      Either<ServerFailure, List<BranchEntity>> branches,
    ) = await (
      usersRepo.fetchRoles(),
      usersRepo.fetchBranches(),
    ).wait;

    // Lookups failing is not fatal: the list still renders, the filter sheet
    // just has less to offer.
    _roles = roles.getOrElse(() => _roles);
    _branches = branches.getOrElse(() => _branches);
  }
}
