import 'package:equatable/equatable.dart';
import 'package:machinery/core/constants/api_keys.dart';

/// The filter set behind `GET /users`. Held as one object so the list cubit
/// can carry the current filters across a refresh without rebuilding them
/// field by field.
class UsersQueryParams extends Equatable {
  const UsersQueryParams({
    this.page = 1,
    this.limit = 20,
    this.search,
    this.roleId,
    this.branchId,
    this.isActive,
  });

  final int page;
  final int limit;
  final String? search;
  final String? roleId;
  final String? branchId;

  /// Null means "both", which is not the same as false.
  final bool? isActive;

  bool get hasFilters => roleId != null || branchId != null || isActive != null;

  UsersQueryParams copyWith({
    int? page,
    int? limit,
    String? search,
    String? roleId,
    String? branchId,
    bool? isActive,
    bool resetSearch = false,
    bool resetRole = false,
    bool resetBranch = false,
    bool resetActive = false,
  }) {
    return UsersQueryParams(
      page: page ?? this.page,
      limit: limit ?? this.limit,
      search: resetSearch ? null : (search ?? this.search),
      roleId: resetRole ? null : (roleId ?? this.roleId),
      branchId: resetBranch ? null : (branchId ?? this.branchId),
      isActive: resetActive ? null : (isActive ?? this.isActive),
    );
  }

  /// Omits anything unset — sending `search=` would filter on an empty string.
  Map<String, dynamic> toQuery() {
    final String? trimmed = search?.trim();

    return <String, dynamic>{
      ApiKeys.page: page,
      ApiKeys.limit: limit,
      if (trimmed != null && trimmed.isNotEmpty) ApiKeys.search: trimmed,
      if (roleId != null) ApiKeys.roleId: roleId,
      if (branchId != null) ApiKeys.branchId: branchId,
      if (isActive != null) ApiKeys.isActive: isActive.toString(),
    };
  }

  @override
  List<Object?> get props => <Object?>[
    page,
    limit,
    search,
    roleId,
    branchId,
    isActive,
  ];
}
