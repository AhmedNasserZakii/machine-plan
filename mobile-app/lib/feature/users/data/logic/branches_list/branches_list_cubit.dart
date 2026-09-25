import 'dart:async';

import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/users/data/logic/branches_list/branches_list_state.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';
import 'package:machinery/feature/users/domain/repos/users_repo.dart';

/// Admin list of branches. Reads include inactive rows so a deactivated
/// branch can be found and restored.
class BranchesListCubit extends Cubit<BranchesListState> {
  BranchesListCubit({required this.usersRepo})
    : super(const BranchesListLoading());

  final UsersRepo usersRepo;

  static const Duration searchDebounce = Duration(milliseconds: 250);

  Timer? _searchTimer;

  @override
  Future<void> close() {
    _searchTimer?.cancel();
    return super.close();
  }

  Future<void> load({bool showLoader = true}) async {
    if (isClosed) {
      return;
    }

    final String search = switch (state) {
      BranchesListLoaded(:final String search) => search,
      _ => '',
    };

    if (showLoader) {
      emit(const BranchesListLoading());
    }

    final Either<ServerFailure, List<BranchEntity>> result = await usersRepo
        .fetchBranches(includeInactive: true);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        BranchesListFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (List<BranchEntity> branches) =>
          emit(BranchesListLoaded(branches: branches, search: search)),
    );
  }

  void search(String query) {
    _searchTimer?.cancel();
    _searchTimer = Timer(searchDebounce, () {
      final BranchesListState current = state;
      if (current is! BranchesListLoaded || isClosed) {
        return;
      }

      emit(current.copyWith(search: query));
    });
  }
}
