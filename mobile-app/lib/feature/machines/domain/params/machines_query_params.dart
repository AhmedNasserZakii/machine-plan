import 'package:equatable/equatable.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/utils/enums.dart';

/// The filter set behind `GET /machines`. Held as one object so the list cubit
/// carries the current filters across a refresh instead of rebuilding them
/// field by field.
class MachinesQueryParams extends Equatable {
  const MachinesQueryParams({
    this.page = 1,
    this.limit = 20,
    this.search,
    this.statuses = const <MachineStatus>[],
    this.machineTypeId,
    this.machineModelId,
    this.branchId,
    this.holderType,
    this.holderId,
    this.warrantyExpiringBefore,
    this.minRepairCost,
    this.includeRetired = false,
  });

  final int page;
  final int limit;

  /// Matches any of the four serials — machine, battery, SIM or box.
  final String? search;

  final List<MachineStatus> statuses;
  final String? machineTypeId;
  final String? machineModelId;
  final String? branchId;
  final PartyType? holderType;

  /// Scopes to whatever one specific party currently holds — the machine
  /// picker sheet's "in your custody" list, in particular.
  final String? holderId;
  final String? warrantyExpiringBefore;
  final double? minRepairCost;

  /// Decommissioned and replaced units are hidden by default: they are not part
  /// of the fleet anyone can act on.
  final bool includeRetired;

  bool get hasFilters =>
      statuses.isNotEmpty ||
      machineTypeId != null ||
      machineModelId != null ||
      branchId != null ||
      holderType != null ||
      warrantyExpiringBefore != null ||
      minRepairCost != null ||
      includeRetired;

  /// How many filters the chip row has to render, which is also the badge count
  /// on the filter button.
  int get activeFilterCount => <bool>[
    statuses.isNotEmpty,
    machineTypeId != null,
    machineModelId != null,
    branchId != null,
    holderType != null,
    warrantyExpiringBefore != null,
    minRepairCost != null,
    includeRetired,
  ].where((bool active) => active).length;

  MachinesQueryParams copyWith({
    int? page,
    int? limit,
    String? search,
    List<MachineStatus>? statuses,
    String? machineTypeId,
    String? machineModelId,
    String? branchId,
    PartyType? holderType,
    String? holderId,
    String? warrantyExpiringBefore,
    double? minRepairCost,
    bool? includeRetired,
    bool resetSearch = false,
    bool resetType = false,
    bool resetModel = false,
    bool resetBranch = false,
    bool resetHolderType = false,
    bool resetHolderId = false,
    bool resetWarranty = false,
    bool resetMinRepairCost = false,
  }) {
    return MachinesQueryParams(
      page: page ?? this.page,
      limit: limit ?? this.limit,
      search: resetSearch ? null : (search ?? this.search),
      statuses: statuses ?? this.statuses,
      machineTypeId: resetType ? null : (machineTypeId ?? this.machineTypeId),
      machineModelId: resetModel
          ? null
          : (machineModelId ?? this.machineModelId),
      branchId: resetBranch ? null : (branchId ?? this.branchId),
      holderType: resetHolderType ? null : (holderType ?? this.holderType),
      holderId: resetHolderId ? null : (holderId ?? this.holderId),
      warrantyExpiringBefore: resetWarranty
          ? null
          : (warrantyExpiringBefore ?? this.warrantyExpiringBefore),
      minRepairCost: resetMinRepairCost
          ? null
          : (minRepairCost ?? this.minRepairCost),
      includeRetired: includeRetired ?? this.includeRetired,
    );
  }

  /// Drops everything but the search term, which the chip row's "clear all"
  /// uses — clearing filters should not also clear what the user typed.
  MachinesQueryParams cleared() =>
      MachinesQueryParams(page: 1, limit: limit, search: search);

  /// Omits anything unset — sending `search=` would filter on an empty string.
  Map<String, dynamic> toQuery() {
    final String? trimmed = search?.trim();

    return <String, dynamic>{
      ApiKeys.page: page,
      ApiKeys.limit: limit,
      if (trimmed != null && trimmed.isNotEmpty) ApiKeys.search: trimmed,
      if (statuses.isNotEmpty)
        ApiKeys.status: statuses
            .map((MachineStatus status) => status.value)
            .toList(growable: false),
      if (machineTypeId != null) ApiKeys.machineTypeId: machineTypeId,
      if (machineModelId != null) ApiKeys.machineModelId: machineModelId,
      if (branchId != null) ApiKeys.branchId: branchId,
      if (holderType != null) ApiKeys.holderType: holderType!.value,
      if (holderId != null) ApiKeys.holderId: holderId,
      if (warrantyExpiringBefore != null)
        ApiKeys.warrantyExpiringBefore: warrantyExpiringBefore,
      if (minRepairCost != null) ApiKeys.minRepairCost: minRepairCost,
      if (includeRetired) ApiKeys.includeRetired: 'true',
    };
  }

  @override
  List<Object?> get props => <Object?>[
    page,
    limit,
    search,
    statuses,
    machineTypeId,
    machineModelId,
    branchId,
    holderType,
    holderId,
    warrantyExpiringBefore,
    minRepairCost,
    includeRetired,
  ];
}
