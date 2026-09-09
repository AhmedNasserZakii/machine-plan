import 'package:equatable/equatable.dart';
import 'package:machinery/core/constants/api_keys.dart';

/// The filter set behind `GET /merchants`. Held as one object so the list cubit
/// carries the current filters across a refresh.
class MerchantsQueryParams extends Equatable {
  const MerchantsQueryParams({
    this.page = 1,
    this.limit = 20,
    this.search,
    this.branchId,
    this.createdByUserId,
    this.hasMachines,
    this.includeInactive = false,
  });

  final int page;
  final int limit;

  /// Matches name, shop name or phone.
  final String? search;

  final String? branchId;

  /// The representative who registered the shop. A supervisor uses it to read
  /// one rep's book without reading the branch's.
  final String? createdByUserId;

  /// Splits the book into shops actually running a machine and shops that are
  /// only on paper.
  final bool? hasMachines;

  /// Closed-out merchants are hidden by default — there is nothing left to do
  /// with them.
  final bool includeInactive;

  bool get hasFilters =>
      branchId != null ||
      createdByUserId != null ||
      hasMachines != null ||
      includeInactive;

  int get activeFilterCount => <bool>[
    branchId != null,
    createdByUserId != null,
    hasMachines != null,
    includeInactive,
  ].where((bool active) => active).length;

  MerchantsQueryParams copyWith({
    int? page,
    int? limit,
    String? search,
    String? branchId,
    String? createdByUserId,
    bool? hasMachines,
    bool? includeInactive,
    bool resetSearch = false,
    bool resetBranch = false,
    bool resetCreatedBy = false,
    bool resetHasMachines = false,
  }) {
    return MerchantsQueryParams(
      page: page ?? this.page,
      limit: limit ?? this.limit,
      search: resetSearch ? null : (search ?? this.search),
      branchId: resetBranch ? null : (branchId ?? this.branchId),
      createdByUserId: resetCreatedBy
          ? null
          : (createdByUserId ?? this.createdByUserId),
      hasMachines: resetHasMachines ? null : (hasMachines ?? this.hasMachines),
      includeInactive: includeInactive ?? this.includeInactive,
    );
  }

  /// Drops everything but the search term — clearing filters should not also
  /// clear what the user typed.
  MerchantsQueryParams cleared() =>
      MerchantsQueryParams(page: 1, limit: limit, search: search);

  /// The server hides deactivated merchants unless asked, so the flag is only
  /// worth sending when it is on.
  Map<String, dynamic> toQuery() {
    final String? trimmed = search?.trim();

    return <String, dynamic>{
      ApiKeys.page: page,
      ApiKeys.limit: limit,
      if (trimmed != null && trimmed.isNotEmpty) ApiKeys.search: trimmed,
      if (branchId != null) ApiKeys.branchId: branchId,
      if (createdByUserId != null) ApiKeys.createdByUserId: createdByUserId,
      if (hasMachines != null) ApiKeys.hasMachines: hasMachines,
      if (includeInactive) ApiKeys.includeInactive: true,
    };
  }

  @override
  List<Object?> get props => <Object?>[
    page,
    limit,
    search,
    branchId,
    createdByUserId,
    hasMachines,
    includeInactive,
  ];
}
