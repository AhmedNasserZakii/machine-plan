import 'dart:typed_data';

import 'package:dartz/dartz.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';

class MaintenanceOrdersPage {
  const MaintenanceOrdersPage({required this.orders, required this.meta});

  final List<MaintenanceOrderEntity> orders;
  final PaginationMetaModel meta;
}

class ReplacementsPage {
  const ReplacementsPage({required this.replacements, required this.meta});

  final List<ReplacementEntity> replacements;
  final PaginationMetaModel meta;
}

class DecommissionsPage {
  const DecommissionsPage({required this.decommissions, required this.meta});

  final List<DecommissionEntity> decommissions;
  final PaginationMetaModel meta;
}

class DecommissionCandidatesPage {
  const DecommissionCandidatesPage({
    required this.candidates,
    required this.meta,
  });

  final List<DecommissionCandidateEntity> candidates;
  final PaginationMetaModel meta;
}

/// Deliberately, entirely online-only (`11`): a repair, a swap and a
/// scrapping are each a real hand-off with real evidence, exactly the kind of
/// write this app already treats as too consequential to accept from a stale
/// local guess — no `cachedXDao`, no optimistic row, no sync queue entry
/// anywhere in this file.
abstract class MaintenanceRepo {
  /// Reserve-upload-confirm against the same generic media store transfers use
  /// (`SIGNATURE` purpose) — a hand-off's signature is a hand-off's signature
  /// whether it is a transfer or a repair, and there is deliberately only one
  /// implementation of that dance in the app.
  Future<Either<ServerFailure, String>> uploadSignature({
    required Uint8List png,
  });

  Future<Either<ServerFailure, MaintenanceOrdersPage>> fetchOrders({
    required MaintenanceOrdersQueryParams params,
  });

  Future<Either<ServerFailure, MaintenanceOrderEntity>> fetchOrder({
    required String id,
  });

  Future<Either<ServerFailure, MaintenanceOrderEntity>> createOrder({
    required CreateMaintenanceOrderParams params,
  });

  Future<Either<ServerFailure, MaintenanceOrderEntity>> updateOrder({
    required String id,
    required UpdateMaintenanceOrderParams params,
  });

  Future<Either<ServerFailure, MaintenanceOrderEntity>> sendOrder({
    required String id,
    required MaintenanceHandoverParams params,
  });

  Future<Either<ServerFailure, MaintenanceOrderEntity>> receiveOrder({
    required String id,
    required MaintenanceHandoverParams params,
  });

  Future<Either<ServerFailure, MaintenanceOrderEntity>> cancelOrder({
    required String id,
    required CancelMaintenanceOrderParams params,
  });

  Future<Either<ServerFailure, MaintenanceOrderEntity>> closeOrder({
    required String id,
    required CloseMaintenanceOrderParams params,
  });

  /// The standalone door — works with or without an open order on the
  /// machine (`11.3`).
  Future<Either<ServerFailure, MachineReplacedEntity>> replaceMachine({
    required String machineId,
    required ReplacementMachineParams params,
  });

  Future<Either<ServerFailure, ReplacementsPage>> fetchReplacements({
    String? machineId,
    String? maintenanceOrderId,
  });

  Future<Either<ServerFailure, DecommissionEntity>> fetchDecommission({
    required String machineId,
  });

  Future<Either<ServerFailure, DecommissionEntity>> decommissionMachine({
    required String machineId,
    required DecommissionMachineParams params,
  });

  Future<Either<ServerFailure, Unit>> revertDecommission({
    required String machineId,
    required RevertDecommissionParams params,
  });

  Future<Either<ServerFailure, DecommissionsPage>> fetchDecommissions({
    required DecommissionsQueryParams params,
  });

  Future<Either<ServerFailure, DecommissionCandidatesPage>>
  fetchDecommissionCandidates({
    required DecommissionCandidatesQueryParams params,
  });
}
