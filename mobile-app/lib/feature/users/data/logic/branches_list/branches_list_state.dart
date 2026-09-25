import 'package:equatable/equatable.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

sealed class BranchesListState extends Equatable {
  const BranchesListState();

  @override
  List<Object?> get props => <Object?>[];
}

class BranchesListLoading extends BranchesListState {
  const BranchesListLoading();
}

class BranchesListLoaded extends BranchesListState {
  const BranchesListLoaded({required this.branches, this.search = ''});

  final List<BranchEntity> branches;
  final String search;

  List<BranchEntity> get visible {
    final String query = search.trim().toLowerCase();
    if (query.isEmpty) {
      return branches;
    }

    return branches
        .where((BranchEntity branch) {
          return branch.name.toLowerCase().contains(query) ||
              branch.code.toLowerCase().contains(query) ||
              (branch.address?.toLowerCase().contains(query) ?? false) ||
              (branch.phone?.contains(query) ?? false);
        })
        .toList(growable: false);
  }

  BranchesListLoaded copyWith({List<BranchEntity>? branches, String? search}) {
    return BranchesListLoaded(
      branches: branches ?? this.branches,
      search: search ?? this.search,
    );
  }

  @override
  List<Object?> get props => <Object?>[branches, search];
}

class BranchesListFailure extends BranchesListState {
  const BranchesListFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
