import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:get_it/get_it.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/local_db/app_database.dart';
import 'package:machinery/core/local_db/daos/cached_branches_dao.dart';
import 'package:machinery/core/local_db/daos/cached_lookups_dao.dart';
import 'package:machinery/core/local_db/daos/cached_machines_dao.dart';
import 'package:machinery/core/local_db/daos/cached_merchants_dao.dart';
import 'package:machinery/core/local_db/daos/cached_transfers_dao.dart';
import 'package:machinery/core/local_db/daos/pending_media_dao.dart';
import 'package:machinery/core/local_db/daos/sync_queue_dao.dart';
import 'package:machinery/core/lookups/lookups_repo.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/services/biometric/biometric_service.dart';
import 'package:machinery/core/services/biometric/handover_biometric_service.dart';
import 'package:machinery/core/services/finance_change_notifier.dart';
import 'package:machinery/core/services/locale_service.dart';
import 'package:machinery/core/services/sync/pending_sync_counter.dart';
import 'package:machinery/core/services/sync/finance_sync_queue.dart';
import 'package:machinery/core/services/sync/media_staging_service.dart';
import 'package:machinery/core/services/sync/sync_api.dart';
import 'package:machinery/core/services/sync/sync_coordinator.dart';
import 'package:machinery/core/services/sync/sync_queue_service.dart';
import 'package:machinery/feature/sync/data/logic/sync_queue_cubit.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_cubit.dart';
import 'package:machinery/feature/auth/data/logic/change_password/change_password_cubit.dart';
import 'package:machinery/feature/auth/data/logic/login/login_cubit.dart';
import 'package:machinery/feature/auth/domain/repos/auth_repo.dart';
import 'package:machinery/feature/auth/domain/repos/auth_repo_impl.dart';
import 'package:machinery/feature/machines/data/logic/machine_detail/machine_detail_cubit.dart';
import 'package:machinery/feature/reports/data/logic/report_viewer/report_viewer_cubit.dart';
import 'package:machinery/feature/reports/data/logic/reports_hub/reports_hub_cubit.dart';
import 'package:machinery/feature/reports/domain/entities/report_entities.dart';
import 'package:machinery/feature/reports/domain/repos/reports_repo.dart';
import 'package:machinery/feature/reports/domain/repos/reports_repo_impl.dart';
import 'package:machinery/feature/finance/data/logic/finance_overview/finance_overview_cubit.dart';
import 'package:machinery/feature/finance/data/logic/transactions/finance_transactions_cubit.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo_impl.dart';
import 'package:machinery/feature/home/data/logic/home_dashboard_cubit.dart';
import 'package:machinery/feature/home/domain/repos/home_repo.dart';
import 'package:machinery/feature/home/domain/repos/home_repo_impl.dart';
import 'package:machinery/feature/machines/data/logic/machine_bulk_import/machine_bulk_import_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_form/machine_form_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_maintenance_history/machine_maintenance_history_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_timeline/machine_timeline_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machines_list/machines_list_cubit.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo_impl.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_create/maintenance_create_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_detail/maintenance_detail_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_list/maintenance_list_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/machine_replacement/machine_replacement_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/machine_decommission/machine_decommission_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/decommission_candidates/decommission_candidates_cubit.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/repos/maintenance_repo.dart';
import 'package:machinery/feature/maintenance/domain/repos/maintenance_repo_impl.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_detail/merchant_detail_cubit.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_form/merchant_form_cubit.dart';
import 'package:machinery/feature/merchants/data/logic/merchants_list/merchants_list_cubit.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/domain/repos/merchants_repo.dart';
import 'package:machinery/feature/merchants/domain/repos/merchants_repo_impl.dart';
import 'package:machinery/feature/transfers/data/logic/confirm_transfer/confirm_transfer_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/transfer_detail/transfer_detail_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/transfers_list/transfers_list_cubit.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo_impl.dart';
import 'package:machinery/feature/more/data/logic/logout/logout_cubit.dart';
import 'package:machinery/feature/scanning/data/logic/scanner/scanner_cubit.dart';
import 'package:machinery/feature/users/data/logic/user_actions/user_actions_cubit.dart';
import 'package:machinery/feature/users/data/logic/user_detail/user_detail_cubit.dart';
import 'package:machinery/feature/users/data/logic/user_form/user_form_cubit.dart';
import 'package:machinery/feature/users/data/logic/user_permissions/user_permissions_cubit.dart';
import 'package:machinery/feature/users/data/logic/users_list/users_list_cubit.dart';
import 'package:machinery/feature/users/data/logic/roles/roles_cubit.dart';
import 'package:machinery/feature/users/domain/entities/user_entity.dart';
import 'package:machinery/feature/users/domain/repos/users_repo.dart';
import 'package:machinery/feature/users/domain/repos/users_repo_impl.dart';
import 'package:machinery/feature/violations/data/logic/violation_create/violation_create_cubit.dart';
import 'package:machinery/feature/violations/data/logic/violation_detail/violation_detail_cubit.dart';
import 'package:machinery/feature/violations/data/logic/violation_summary/violation_summary_cubit.dart';
import 'package:machinery/feature/violations/data/logic/violations_list/violations_list_cubit.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/repos/violations_repo.dart';
import 'package:machinery/feature/violations/domain/repos/violations_repo_impl.dart';

final GetIt getIt = GetIt.instance;

/// [appDatabase] is opened by `main()` before this runs — every DAO
/// constructed here needs its already-open `Database` synchronously, which a
/// `registerLazySingleton` factory cannot await.
void setupServiceLocator(AppDatabase appDatabase) {
  // ── Core singletons ──────────────────────────────────────────────────────
  getIt.registerLazySingleton<ApiService>(ApiService.new);
  getIt.registerLazySingleton<Connectivity>(Connectivity.new);
  getIt.registerLazySingleton<NetworkInfo>(
    () => NetworkInfoImpl(connectivity: getIt()),
  );

  // ── Offline local database (`6.1`/`6.2`) ─────────────────────────────────
  getIt.registerSingleton<AppDatabase>(appDatabase);
  getIt.registerLazySingleton<CachedMachinesDao>(
    () => CachedMachinesDao(getIt()),
  );
  getIt.registerLazySingleton<CachedMerchantsDao>(
    () => CachedMerchantsDao(getIt()),
  );
  getIt.registerLazySingleton<CachedBranchesDao>(
    () => CachedBranchesDao(getIt()),
  );
  getIt.registerLazySingleton<CachedLookupsDao>(
    () => CachedLookupsDao(getIt()),
  );
  getIt.registerLazySingleton<CachedTransfersDao>(
    () => CachedTransfersDao(getIt()),
  );
  getIt.registerLazySingleton<SyncQueueDao>(() => SyncQueueDao(getIt()));
  getIt.registerLazySingleton<PendingMediaDao>(() => PendingMediaDao(getIt()));

  // ── Offline sync engine (`6.3`/`6.4`/`6.5`) ──────────────────────────────
  getIt.registerLazySingleton<SyncApi>(() => SyncApi(apiService: getIt()));
  getIt.registerLazySingleton<MediaStagingService>(
    () => MediaStagingService(
      pendingMediaDao: getIt(),
      apiService: getIt(),
      networkInfo: getIt(),
    ),
  );
  getIt.registerLazySingleton<SyncQueueService>(
    () => SyncQueueService(
      queueDao: getIt(),
      pendingMediaDao: getIt(),
      mediaStaging: getIt(),
      syncApi: getIt(),
      networkInfo: getIt(),
      cachedMerchantsDao: getIt(),
      cachedTransfersDao: getIt(),
    ),
  );
  getIt.registerLazySingleton<SyncCoordinator>(
    () => SyncCoordinator(
      syncApi: getIt(),
      syncQueueService: getIt(),
      mediaStaging: getIt(),
      networkInfo: getIt(),
      permissionService: getIt(),
      cachedMachinesDao: getIt(),
      cachedMerchantsDao: getIt(),
      cachedBranchesDao: getIt(),
      cachedLookupsDao: getIt(),
      cachedTransfersDao: getIt(),
    ),
  );
  getIt.registerFactory<SyncQueueCubit>(
    () => SyncQueueCubit(
      syncQueueService: getIt(),
      syncCoordinator: getIt(),
      networkInfo: getIt(),
    ),
  );

  // Session state is global, so the permission list is a singleton. Cubits
  // stay factories: a screen must never inherit another screen's state.
  getIt.registerLazySingleton<PermissionService>(PermissionService.new);
  getIt.registerLazySingleton<LocaleService>(LocaleService.new);
  getIt.registerLazySingleton<FinanceChangeNotifier>(FinanceChangeNotifier.new);
  getIt.registerLazySingleton<BiometricService>(BiometricService.new);
  getIt.registerLazySingleton<HandoverBiometricService>(
    HandoverBiometricService.new,
  );

  // Reference tables are held for the session, so this has to outlive the
  // screens that read them.
  getIt.registerLazySingleton<LookupsRepo>(
    () => LookupsRepo(apiService: getIt()),
  );

  // ── Auth ─────────────────────────────────────────────────────────────────
  getIt.registerLazySingleton<AuthRepo>(
    () => AuthRepoImpl(networkInfo: getIt()),
  );

  // AuthCubit is the one singleton cubit: session state is app-wide.
  getIt.registerLazySingleton<AuthCubit>(
    () => AuthCubit(
      authRepo: getIt(),
      permissionService: getIt(),
      syncCoordinator: getIt(),
    ),
  );

  getIt.registerFactory<LoginCubit>(
    () => LoginCubit(authRepo: getIt(), authCubit: getIt()),
  );
  getIt.registerFactory<ChangePasswordCubit>(
    () => ChangePasswordCubit(authRepo: getIt(), authCubit: getIt()),
  );

  // ── More ─────────────────────────────────────────────────────────────────
  getIt.registerLazySingleton<FinanceSyncQueue>(FinanceSyncQueue.new);

  // Two independent queues (`6.4`'s general `SyncQueueService` for
  // transfers/merchants, and finance's pre-existing `FinanceSyncQueue`) sum
  // into the one count the logout warning shows.
  getIt.registerLazySingleton<PendingSyncCounter>(
    () => CompositePendingSyncCounter(
      counters: <PendingSyncCounter>[
        getIt<SyncQueueService>(),
        getIt<FinanceSyncQueue>(),
      ],
    ),
  );

  getIt.registerFactory<LogoutCubit>(
    () => LogoutCubit(authCubit: getIt(), pendingSyncCounter: getIt()),
  );

  // ── Finance ──────────────────────────────────────────────────────────────
  getIt.registerLazySingleton<FinanceRepo>(
    () => FinanceRepoImpl(
      apiService: getIt(),
      networkInfo: getIt(),
      queue: getIt(),
    ),
  );
  getIt.registerFactory<FinanceOverviewCubit>(
    () => FinanceOverviewCubit(
      repo: getIt(),
      queue: getIt(),
      financeChangeNotifier: getIt(),
    ),
  );
  getIt.registerFactory<FinanceTransactionsCubit>(
    () => FinanceTransactionsCubit(repo: getIt()),
  );

  // ── Reports ──────────────────────────────────────────────────────────────
  // Singleton so export polling and downloaded-file state survive navigation.
  getIt.registerLazySingleton<ReportsRepo>(
    () => ReportsRepoImpl(apiService: getIt(), networkInfo: getIt()),
  );
  getIt.registerFactory<ReportsHubCubit>(() => ReportsHubCubit(repo: getIt()));
  getIt.registerFactoryParam<ReportViewerCubit, ReportDefinition, void>(
    (ReportDefinition report, _) =>
        ReportViewerCubit(repo: getIt(), report: report),
  );

  // ── Users, roles & permissions ───────────────────────────────────────────
  getIt.registerLazySingleton<UsersRepo>(
    () => UsersRepoImpl(apiService: getIt(), networkInfo: getIt()),
  );

  getIt.registerFactory<UsersListCubit>(
    () => UsersListCubit(usersRepo: getIt()),
  );

  getIt.registerFactoryParam<UserDetailCubit, String, UserEntity?>(
    (String userId, UserEntity? initial) => UserDetailCubit(
      userId: userId,
      initial: initial,
      usersRepo: getIt(),
      violationsRepo: getIt(),
      transfersRepo: getIt(),
      permissions: getIt(),
    ),
  );

  getIt.registerFactory<RolesCubit>(() => RolesCubit(repo: getIt()));

  // The form, the permission editor and the row actions are all scoped to one
  // account, which arrives as a route parameter rather than through the
  // locator's global state.
  getIt.registerFactoryParam<UserFormCubit, UserEntity?, void>(
    (UserEntity? existing, _) =>
        UserFormCubit(usersRepo: getIt(), existing: existing),
  );

  getIt.registerFactoryParam<UserPermissionsCubit, String, void>(
    (String userId, _) =>
        UserPermissionsCubit(usersRepo: getIt(), userId: userId),
  );

  getIt.registerFactoryParam<UserActionsCubit, UserEntity, void>(
    (UserEntity user, _) => UserActionsCubit(
      usersRepo: getIt(),
      userId: user.id,
      isActive: user.isActive,
    ),
  );

  // ── Machines & scanning ──────────────────────────────────────────────────
  getIt.registerLazySingleton<MachinesRepo>(
    () => MachinesRepoImpl(
      apiService: getIt(),
      networkInfo: getIt(),
      cachedMachinesDao: getIt(),
    ),
  );

  getIt.registerFactory<MachinesListCubit>(
    () => MachinesListCubit(machinesRepo: getIt()),
  );

  // The detail screen takes the row the list already has as a second param, so
  // it can paint the serial and status before the full record arrives.
  getIt.registerFactoryParam<MachineDetailCubit, String, MachineEntity?>(
    (String machineId, MachineEntity? initial) => MachineDetailCubit(
      machinesRepo: getIt(),
      machineId: machineId,
      initial: initial,
    ),
  );

  getIt.registerFactoryParam<MachineFormCubit, MachineEntity?, void>(
    (MachineEntity? existing, _) =>
        MachineFormCubit(machinesRepo: getIt(), existing: existing),
  );

  getIt.registerFactory<ScannerCubit>(
    () => ScannerCubit(machinesRepo: getIt()),
  );

  getIt.registerFactory<MachineBulkImportCubit>(
    () => MachineBulkImportCubit(machinesRepo: getIt()),
  );

  getIt.registerFactoryParam<MachineTimelineCubit, String, void>(
    (String machineId, _) =>
        MachineTimelineCubit(machinesRepo: getIt(), machineId: machineId),
  );

  getIt.registerFactoryParam<MachineMaintenanceHistoryCubit, String, void>(
    (String machineId, _) => MachineMaintenanceHistoryCubit(
      machinesRepo: getIt(),
      machineId: machineId,
    ),
  );

  // ── Transfers ────────────────────────────────────────────────────────────
  getIt.registerLazySingleton<TransfersRepo>(
    () => TransfersRepoImpl(
      apiService: getIt(),
      networkInfo: getIt(),
      cachedTransfersDao: getIt(),
      pendingMediaDao: getIt(),
      mediaStaging: getIt(),
      syncQueueService: getIt(),
      syncCoordinator: getIt(),
    ),
  );

  getIt.registerFactory<TransfersListCubit>(
    () => TransfersListCubit(transfersRepo: getIt()),
  );

  // The list row arrives as a second param so the header paints before the
  // full document does.
  getIt.registerFactoryParam<TransferDetailCubit, String, TransferEntity?>(
    (String transferId, TransferEntity? initial) => TransferDetailCubit(
      transfersRepo: getIt(),
      transferId: transferId,
      initial: initial,
    ),
  );

  getIt.registerFactoryParam<ConfirmTransferCubit, TransferEntity, void>(
    (TransferEntity transfer, _) =>
        ConfirmTransferCubit(transfersRepo: getIt(), transfer: transfer),
  );

  getIt.registerFactory<CreateTransferCubit>(
    () => CreateTransferCubit(transfersRepo: getIt(), networkInfo: getIt()),
  );

  // ── Merchants ────────────────────────────────────────────────────────────
  getIt.registerLazySingleton<MerchantsRepo>(
    () => MerchantsRepoImpl(
      apiService: getIt(),
      networkInfo: getIt(),
      cachedMerchantsDao: getIt(),
      syncQueueService: getIt(),
      syncCoordinator: getIt(),
    ),
  );

  getIt.registerFactory<MerchantsListCubit>(
    () => MerchantsListCubit(merchantsRepo: getIt()),
  );

  // The list row arrives as a second param so the shop name and phone paint
  // before the full record does.
  getIt.registerFactoryParam<MerchantDetailCubit, String, MerchantEntity?>(
    (String merchantId, MerchantEntity? initial) => MerchantDetailCubit(
      merchantsRepo: getIt(),
      merchantId: merchantId,
      initial: initial,
    ),
  );

  getIt.registerFactoryParam<MerchantFormCubit, MerchantEntity?, void>(
    (MerchantEntity? existing, _) =>
        MerchantFormCubit(merchantsRepo: getIt(), existing: existing),
  );

  // ── Violations ───────────────────────────────────────────────────────────
  getIt.registerLazySingleton<ViolationsRepo>(
    () => ViolationsRepoImpl(apiService: getIt(), networkInfo: getIt()),
  );

  getIt.registerFactory<ViolationsListCubit>(
    () => ViolationsListCubit(violationsRepo: getIt()),
  );

  getIt.registerFactoryParam<ViolationDetailCubit, String, ViolationEntity?>(
    (String violationId, ViolationEntity? initial) => ViolationDetailCubit(
      violationsRepo: getIt(),
      violationId: violationId,
      financeChangeNotifier: getIt(),
      initial: initial,
    ),
  );

  getIt.registerFactoryParam<ViolationSummaryCubit, String, void>(
    (String userId, _) =>
        ViolationSummaryCubit(violationsRepo: getIt(), userId: userId),
  );

  getIt.registerFactory<ViolationCreateCubit>(
    () => ViolationCreateCubit(violationsRepo: getIt()),
  );

  // ── Maintenance, replacement, decommission ─────────────────────────────────
  getIt.registerLazySingleton<MaintenanceRepo>(
    () => MaintenanceRepoImpl(apiService: getIt(), networkInfo: getIt()),
  );

  getIt.registerFactory<MaintenanceListCubit>(
    () => MaintenanceListCubit(maintenanceRepo: getIt()),
  );

  getIt.registerFactoryParam<
    MaintenanceDetailCubit,
    String,
    MaintenanceOrderEntity?
  >(
    (String orderId, MaintenanceOrderEntity? initial) => MaintenanceDetailCubit(
      maintenanceRepo: getIt(),
      orderId: orderId,
      initial: initial,
    ),
  );

  getIt.registerFactory<MaintenanceCreateCubit>(
    () => MaintenanceCreateCubit(maintenanceRepo: getIt()),
  );

  getIt.registerFactoryParam<MachineReplacementCubit, MachineEntity, void>(
    (MachineEntity machine, _) => MachineReplacementCubit(
      maintenanceRepo: getIt(),
      machinesRepo: getIt(),
      machine: machine,
    ),
  );

  getIt.registerFactoryParam<MachineDecommissionCubit, String, void>(
    (String machineId, _) => MachineDecommissionCubit(
      machineId: machineId,
      maintenanceRepo: getIt(),
      lookupsRepo: getIt(),
    ),
  );

  getIt.registerFactory<DecommissionCandidatesCubit>(
    () => DecommissionCandidatesCubit(repo: getIt()),
  );

  // ── Home dashboard ───────────────────────────────────────────────────────
  getIt.registerLazySingleton<HomeRepo>(
    () => HomeRepoImpl(
      apiService: getIt(),
      networkInfo: getIt(),
      machinesRepo: getIt(),
      transfersRepo: getIt(),
      merchantsRepo: getIt(),
      violationsRepo: getIt(),
      financeRepo: getIt(),
    ),
  );

  getIt.registerFactory<HomeDashboardCubit>(
    () => HomeDashboardCubit(
      repo: getIt(),
      permissionService: getIt(),
      financeChangeNotifier: getIt(),
    ),
  );
}

/// Resolves the HTTP service only after [setupServiceLocator] has run.
///
/// This must stay a getter rather than a top-level `final`: top-level variables
/// are evaluated when this library is imported, which happens before `main()`
/// can call [setupServiceLocator].
ApiService get apiService => getIt<ApiService>();
