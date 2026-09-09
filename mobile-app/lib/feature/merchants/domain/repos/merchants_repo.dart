import 'package:dartz/dartz.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/domain/params/merchant_form_params.dart';
import 'package:machinery/feature/merchants/domain/params/merchants_query_params.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

/// One page of merchants plus the paging metadata the list needs to know
/// whether to keep scrolling.
class MerchantsPage {
  const MerchantsPage({required this.merchants, required this.meta});

  final List<MerchantEntity> merchants;
  final PaginationMetaModel meta;
}

abstract class MerchantsRepo {
  Future<Either<ServerFailure, MerchantsPage>> fetchMerchants({
    required MerchantsQueryParams params,
  });

  Future<Either<ServerFailure, MerchantEntity>> fetchMerchant({
    required String id,
  });

  /// What the merchant is holding right now — the list a supervisor checks
  /// before agreeing to close his record.
  Future<Either<ServerFailure, List<MachineEntity>>> fetchMerchantMachines({
    required String id,
  });

  Future<Either<ServerFailure, List<SubscriptionEntity>>> fetchSubscriptions({
    required String id,
  });

  Future<Either<ServerFailure, List<MerchantTimelineEntry>>> fetchTimeline({
    required String id,
  });

  /// Run before submitting a registration, so a repeated phone is shown to the
  /// representative as an existing shop rather than surfacing as a server
  /// error after he has typed everything.
  Future<Either<ServerFailure, MerchantDuplicateCheck>> checkDuplicates({
    required CheckMerchantParams params,
  });

  Future<Either<ServerFailure, MerchantEntity>> createMerchant({
    required CreateMerchantParams params,
  });

  Future<Either<ServerFailure, MerchantEntity>> updateMerchant({
    required String id,
    required UpdateMerchantParams params,
  });

  /// Refused by the server while he still holds a machine, which is why the
  /// button is disabled rather than left to fail.
  Future<Either<ServerFailure, Unit>> deactivateMerchant({
    required String id,
    String? reason,
  });

  Future<Either<ServerFailure, SubscriptionEntity>> createSubscription({
    required String merchantId,
    required CreateSubscriptionParams params,
  });

  Future<Either<ServerFailure, SubscriptionEntity>> updateSubscription({
    required String subscriptionId,
    required UpdateSubscriptionParams params,
  });

  Future<Either<ServerFailure, SubscriptionEntity>> collectSubscription({
    required String subscriptionId,
    required CollectSubscriptionParams params,
  });

  Future<Either<ServerFailure, List<BranchEntity>>> fetchBranches();
}
