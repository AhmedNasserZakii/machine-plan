import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';
import 'package:machinery/feature/home/domain/entities/home_block.dart';
import 'package:machinery/feature/home/domain/entities/home_summaries.dart';
import 'package:machinery/feature/home/domain/repos/home_repo.dart';
import 'package:machinery/feature/machines/domain/params/machines_query_params.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';
import 'package:machinery/feature/merchants/domain/params/merchants_query_params.dart';
import 'package:machinery/feature/merchants/domain/repos/merchants_repo.dart';
import 'package:machinery/feature/transfers/domain/params/transfers_query_params.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo.dart';
import 'package:machinery/feature/violations/domain/params/violations_query_params.dart';
import 'package:machinery/feature/violations/domain/repos/violations_repo.dart';

/// A repair order still open enough to count against the maintenance block —
/// mirrors the backend's `OPEN_MAINTENANCE_STATUSES` (an order in one of
/// these still blocks a second order on the same machine).
const List<String> _openMaintenanceStatuses = <String>[
  'OPEN',
  'IN_PROGRESS',
  'RETURNED',
];

/// Backs every dashboard tile with the same repository the matching feature
/// screen already uses — a `limit: 1` list call read only for its
/// `meta.total` — so a tile's number is always exactly what tapping through
/// to that screen would show, and every tile inherits that repository's own
/// already-tested network-first/cache-fallback behaviour for free rather than
/// a second, subtly different implementation of it.
///
/// Violations, maintenance and finance have no local cache (section 6 only
/// mirrors machines/transfers/merchants), so those three tiles have nothing
/// to fall back to offline and say so plainly instead of guessing.
class HomeRepoImpl implements HomeRepo {
  HomeRepoImpl({
    required this.apiService,
    required this.networkInfo,
    required this.machinesRepo,
    required this.transfersRepo,
    required this.merchantsRepo,
    required this.violationsRepo,
    required this.financeRepo,
  });

  final ApiService apiService;
  final NetworkInfo networkInfo;
  final MachinesRepo machinesRepo;
  final TransfersRepo transfersRepo;
  final MerchantsRepo merchantsRepo;
  final ViolationsRepo violationsRepo;
  final FinanceRepo financeRepo;

  @override
  Future<HomeBlock<MachinesSummary>> machinesSummary() async {
    final bool wasOffline = !await networkInfo.isConnected;
    final result = await machinesRepo.fetchMachines(
      params: const MachinesQueryParams(limit: 1),
    );

    return result.fold(
      (failure) => failure is OfflineFailure
          ? const HomeBlock<MachinesSummary>.offline()
          : HomeBlock<MachinesSummary>.error(failure.errorMessage),
      (page) => HomeBlock<MachinesSummary>.ready(
        MachinesSummary(total: page.meta.total),
        isFromCache: wasOffline,
      ),
    );
  }

  @override
  Future<HomeBlock<TransfersSummary>> transfersSummary() async {
    final bool wasOffline = !await networkInfo.isConnected;
    final result = await transfersRepo.fetchTransfers(
      params: const TransfersQueryParams(
        scope: TransfersScope.incoming,
        limit: 1,
      ),
    );

    return result.fold(
      (failure) => failure is OfflineFailure
          ? const HomeBlock<TransfersSummary>.offline()
          : HomeBlock<TransfersSummary>.error(failure.errorMessage),
      (page) => HomeBlock<TransfersSummary>.ready(
        TransfersSummary(pendingForMe: page.meta.total),
        isFromCache: wasOffline,
      ),
    );
  }

  @override
  Future<HomeBlock<MerchantsSummary>> merchantsSummary() async {
    final bool wasOffline = !await networkInfo.isConnected;
    final result = await merchantsRepo.fetchMerchants(
      params: const MerchantsQueryParams(limit: 1),
    );

    return result.fold(
      (failure) => failure is OfflineFailure
          ? const HomeBlock<MerchantsSummary>.offline()
          : HomeBlock<MerchantsSummary>.error(failure.errorMessage),
      (page) => HomeBlock<MerchantsSummary>.ready(
        MerchantsSummary(total: page.meta.total),
        isFromCache: wasOffline,
      ),
    );
  }

  @override
  Future<HomeBlock<ViolationsSummary>> violationsSummary() async {
    final result = await violationsRepo.fetchViolations(
      params: const ViolationsQueryParams(
        statuses: <ViolationStatus>[ViolationStatus.open],
        limit: 1,
      ),
    );

    return result.fold(
      (failure) => failure is OfflineFailure
          ? const HomeBlock<ViolationsSummary>.offline()
          : HomeBlock<ViolationsSummary>.error(failure.errorMessage),
      (page) => HomeBlock<ViolationsSummary>.ready(
        ViolationsSummary(open: page.meta.total),
      ),
    );
  }

  /// No `MaintenanceRepo` exists yet (section 11 is not built) — this reads
  /// the same `GET /maintenance-orders` list endpoint the future feature will
  /// use, for its `meta.total` alone, rather than standing up a whole
  /// repository layer for one count this section actually needs.
  @override
  Future<HomeBlock<MaintenanceSummary>> maintenanceSummary() async {
    if (!await networkInfo.isConnected) {
      return const HomeBlock<MaintenanceSummary>.offline();
    }

    try {
      final Response<dynamic> response = await apiService.client().get<dynamic>(
        WebConstant.maintenanceOrders,
        queryParameters: <String, dynamic>{
          ApiKeys.page: 1,
          ApiKeys.limit: 1,
          ApiKeys.status: _openMaintenanceStatuses,
        },
      );

      final dynamic body = response.data;
      final Map<String, dynamic> meta =
          body is Map<String, dynamic> && body[ApiKeys.meta] is Map<String, dynamic>
          ? body[ApiKeys.meta] as Map<String, dynamic>
          : const <String, dynamic>{};

      return HomeBlock<MaintenanceSummary>.ready(
        MaintenanceSummary(open: PaginationMetaModel.fromJson(meta).total),
      );
    } on DioException catch (error, stackTrace) {
      printDebug(
        message: 'home repo maintenanceSummary dio exception: ${error.message}',
        stackTrace: stackTrace,
      );
      final ServerFailure failure = ServerFailure.fromDioException(error);
      return failure is OfflineFailure
          ? const HomeBlock<MaintenanceSummary>.offline()
          : HomeBlock<MaintenanceSummary>.error(failure.errorMessage);
    } catch (error, stackTrace) {
      printDebug(message: 'home repo maintenanceSummary catch: $error', stackTrace: stackTrace);
      return HomeBlock<MaintenanceSummary>.error(LocaleKeys.anErrorOccurred.tr());
    }
  }

  @override
  Future<HomeBlock<FinanceSummary>> financeSummary() async {
    final result = await financeRepo.summary(const FinanceQuery());

    return result.fold(
      (failure) => failure is OfflineFailure
          ? const HomeBlock<FinanceSummary>.offline()
          : HomeBlock<FinanceSummary>.error(failure.errorMessage),
      (summary) => HomeBlock<FinanceSummary>.ready(summary),
    );
  }

  @override
  Future<HomeBlock<BudgetStatusList>> budgetsSummary() async {
    final result = await financeRepo.budgetStatus(const FinanceQuery());

    return result.fold(
      (failure) => failure is OfflineFailure
          ? const HomeBlock<BudgetStatusList>.offline()
          : HomeBlock<BudgetStatusList>.error(failure.errorMessage),
      (status) => HomeBlock<BudgetStatusList>.ready(status),
    );
  }
}
