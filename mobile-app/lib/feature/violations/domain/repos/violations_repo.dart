import 'package:dartz/dartz.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/params/violation_action_params.dart';
import 'package:machinery/feature/violations/domain/params/violations_query_params.dart';

/// One page of violations plus the paging metadata the list needs to know
/// whether to keep scrolling.
class ViolationsPage {
  const ViolationsPage({required this.violations, required this.meta});

  final List<ViolationEntity> violations;
  final PaginationMetaModel meta;
}

abstract class ViolationsRepo {
  Future<Either<ServerFailure, ViolationsPage>> fetchViolations({
    required ViolationsQueryParams params,
  });

  Future<Either<ServerFailure, ViolationEntity>> fetchViolation({
    required String id,
  });

  Future<Either<ServerFailure, ViolationEntity>> createViolation({
    required CreateViolationParams params,
  });

  /// Refused on an auto-generated row: a detected mismatch that can be edited
  /// afterwards is not evidence of anything.
  Future<Either<ServerFailure, ViolationEntity>> updateViolation({
    required String id,
    required UpdateViolationParams params,
  });

  /// The person responsible saying he has seen it. It settles nothing.
  Future<Either<ServerFailure, ViolationEntity>> acknowledge({
    required String id,
  });

  /// Writes a finance transaction as well as closing the violation, which is
  /// why this needs a payment method rather than just an amount.
  Future<Either<ServerFailure, ViolationEntity>> charge({
    required String id,
    required ChargeViolationParams params,
  });

  Future<Either<ServerFailure, ViolationEntity>> waive({
    required String id,
    required WaiveViolationParams params,
  });

  Future<Either<ServerFailure, ViolationSummary>> fetchSummary({
    required String userId,
  });
}
