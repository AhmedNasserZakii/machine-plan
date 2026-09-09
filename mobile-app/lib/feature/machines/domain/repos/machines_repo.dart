import 'package:dartz/dartz.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_lookup_result.dart';
import 'package:machinery/feature/machines/domain/params/machine_form_params.dart';
import 'package:machinery/feature/machines/domain/params/machines_query_params.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

/// One page of machines plus the paging metadata the list needs to know whether
/// to keep scrolling.
class MachinesPage {
  const MachinesPage({required this.machines, required this.meta});

  final List<MachineEntity> machines;
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

  Future<Either<ServerFailure, MachineEntity>> updateMachine({
    required String id,
    required UpdateMachineParams params,
  });

  /// Every serial the unit has ever been, oldest first. Empty for a machine
  /// that has never been replaced.
  Future<Either<ServerFailure, List<MachineEntity>>> fetchReplacementChain({
    required String id,
  });

  Future<Either<ServerFailure, List<MachineTypeEntity>>> fetchMachineTypes();

  Future<Either<ServerFailure, List<MachineModelEntity>>> fetchMachineModels();

  Future<Either<ServerFailure, List<BranchEntity>>> fetchBranches();
}
