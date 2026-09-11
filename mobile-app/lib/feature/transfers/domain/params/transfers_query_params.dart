import 'package:equatable/equatable.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/utils/enums.dart';

/// Which of the three list tabs a query is for. The inbox and outbox are their
/// own endpoints rather than filters, because "waiting for me" is a question
/// about the caller and the server is the only one who can answer it.
enum TransfersScope { incoming, outgoing, all }

class TransfersQueryParams extends Equatable {
  const TransfersQueryParams({
    this.scope = TransfersScope.all,
    this.page = 1,
    this.limit = 20,
    this.types = const <TransferType>[],
    this.statuses = const <TransferStatus>[],
    this.branchId,
    this.machineId,
    this.fromPartyId,
    this.toPartyId,
    this.dateFrom,
    this.dateTo,
    this.hasViolations,
  });

  final TransfersScope scope;
  final int page;
  final int limit;
  final List<TransferType> types;
  final List<TransferStatus> statuses;
  final String? branchId;
  final String? machineId;
  final String? fromPartyId;
  final String? toPartyId;

  /// Both bounds read `occurredAt`, not `createdAt`.
  final String? dateFrom;
  final String? dateTo;
  final bool? hasViolations;

  bool get hasFilters =>
      types.isNotEmpty ||
      statuses.isNotEmpty ||
      branchId != null ||
      dateFrom != null ||
      dateTo != null ||
      hasViolations != null;

  int get activeFilterCount => <bool>[
    types.isNotEmpty,
    statuses.isNotEmpty,
    branchId != null,
    dateFrom != null || dateTo != null,
    hasViolations != null,
  ].where((bool active) => active).length;

  TransfersQueryParams copyWith({
    TransfersScope? scope,
    int? page,
    int? limit,
    List<TransferType>? types,
    List<TransferStatus>? statuses,
    String? branchId,
    String? machineId,
    String? fromPartyId,
    String? toPartyId,
    String? dateFrom,
    String? dateTo,
    bool? hasViolations,
    bool resetBranch = false,
    bool resetMachine = false,
    bool resetDates = false,
    bool resetViolations = false,
  }) {
    return TransfersQueryParams(
      scope: scope ?? this.scope,
      page: page ?? this.page,
      limit: limit ?? this.limit,
      types: types ?? this.types,
      statuses: statuses ?? this.statuses,
      branchId: resetBranch ? null : (branchId ?? this.branchId),
      machineId: resetMachine ? null : (machineId ?? this.machineId),
      fromPartyId: fromPartyId ?? this.fromPartyId,
      toPartyId: toPartyId ?? this.toPartyId,
      dateFrom: resetDates ? null : (dateFrom ?? this.dateFrom),
      dateTo: resetDates ? null : (dateTo ?? this.dateTo),
      hasViolations: resetViolations
          ? null
          : (hasViolations ?? this.hasViolations),
    );
  }

  TransfersQueryParams cleared() =>
      TransfersQueryParams(scope: scope, page: 1, limit: limit);

  Map<String, dynamic> toQuery() {
    return <String, dynamic>{
      ApiKeys.page: page,
      ApiKeys.limit: limit,
      if (types.isNotEmpty)
        ApiKeys.type: types
            .map((TransferType type) => type.value)
            .toList(growable: false),
      if (statuses.isNotEmpty)
        ApiKeys.status: statuses
            .map((TransferStatus status) => status.value)
            .toList(growable: false),
      if (branchId != null) ApiKeys.branchId: branchId,
      if (machineId != null) ApiKeys.machineId: machineId,
      if (fromPartyId != null) 'fromPartyId': fromPartyId,
      if (toPartyId != null) 'toPartyId': toPartyId,
      if (dateFrom != null) ApiKeys.dateFrom: dateFrom,
      if (dateTo != null) ApiKeys.dateTo: dateTo,
      if (hasViolations != null)
        ApiKeys.hasViolations: hasViolations! ? 'true' : 'false',
    };
  }

  @override
  List<Object?> get props => <Object?>[
    scope,
    page,
    limit,
    types,
    statuses,
    branchId,
    machineId,
    fromPartyId,
    toPartyId,
    dateFrom,
    dateTo,
    hasViolations,
  ];
}
