import 'package:dartz/dartz.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_lookup_result.dart';
import 'package:machinery/feature/machines/domain/entities/machine_maintenance_history.dart';
import 'package:machinery/feature/machines/domain/entities/machine_timeline_event.dart';
import 'package:machinery/feature/machines/domain/params/machine_form_params.dart';
import 'package:machinery/feature/machines/domain/params/machine_model_form_params.dart';
import 'package:machinery/feature/machines/domain/params/machines_query_params.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

/// One page of machines plus the paging metadata the list needs to know whether
/// to keep scrolling.
class MachinesPage {
  const MachinesPage({required this.machines, required this.meta});

  final List<MachineEntity> machines;
  final PaginationMetaModel meta;
}

/// One keyset page of a machine's timeline.
class MachineTimelinePage {
  const MachineTimelinePage({required this.events, required this.meta});

  final List<MachineTimelineEvent> events;
  final PaginationMetaModel meta;
}

/// Reads will eventually be served from the local cache; writes stay
/// online-only, because factory intake happens at the warehouse where there is
/// a connection, and a serial invented offline could collide on sync.
abstract class MachinesRepo {
  Future<Either<ServerFailure, MachinesPage>> fetchMachines({
    required MachinesQueryParams params,
  });

  Future<Either<ServerFailure, MachineEntity>> fetchMachine({
    required String id,
  });

  /// Resolves a scanned code against all four serials. The result carries which
  /// sticker matched, so the app can tell the user it read the battery.
  Future<Either<ServerFailure, MachineLookupResult>> lookup({
    required String code,
  });

  Future<Either<ServerFailure, MachineEntity>> createMachine({
    required CreateMachineParams params,
  });

  /// Factory intake in bulk (`8.1`). Validated and committed as a whole by the
  /// server — a validation failure creates nothing, so the caller never has to
  /// reconcile a partially-imported batch.
  Future<Either<ServerFailure, List<MachineEntity>>> bulkCreateMachines({
    required List<CreateMachineParams> rows,
  });

  Future<Either<ServerFailure, MachineEntity>> updateMachine({
    required String id,
    required UpdateMachineParams params,
  });

  /// Every serial the unit has ever been, oldest first. Empty for a machine
  /// that has never been replaced.
  Future<Either<ServerFailure, List<MachineEntity>>> fetchReplacementChain({
    required String id,
  });

  /// The full life story, newest first, keyset-paginated (`8.1`). [cursor] is
  /// the previous page's `nextCursor`; omitted for the first page.
  Future<Either<ServerFailure, MachineTimelinePage>> fetchTimeline({
    required String machineId,
    String? cursor,
  });

  /// Every repair this machine has had, with the totals (`8.1`). Read-only:
  /// opening, closing and costing an order belongs to `11`. [page] pages the
  /// orders list; totals stay over the whole history.
  Future<Either<ServerFailure, MachineMaintenanceHistory>>
  fetchMaintenanceHistory({required String machineId, int page = 1});

  Future<Either<ServerFailure, List<MachineTypeEntity>>> fetchMachineTypes();

  /// Catalogue for pickers by default. Admin screens pass [includeInactive] and
  /// [rawTranslations] so they can edit both locales and reactivate a retired
  /// model.
  Future<Either<ServerFailure, List<MachineModelEntity>>> fetchMachineModels({
    bool includeInactive = false,
    bool rawTranslations = false,
  });

  Future<Either<ServerFailure, MachineModelEntity>> createMachineModel({
    required CreateMachineModelParams params,
  });

  Future<Either<ServerFailure, MachineModelEntity>> updateMachineModel({
    required String id,
    required UpdateMachineModelParams params,
  });

  Future<Either<ServerFailure, List<BranchEntity>>> fetchBranches();
}
