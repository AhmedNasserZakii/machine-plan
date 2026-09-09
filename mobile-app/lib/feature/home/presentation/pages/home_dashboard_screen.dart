import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_cubit.dart';
import 'package:machinery/feature/auth/data/logic/auth/auth_state.dart';
import 'package:machinery/feature/finance/data/logic/finance_overview/finance_overview_cubit.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:machinery/feature/finance/presentation/pages/budgets_screen.dart';
import 'package:machinery/feature/finance/presentation/pages/finance_overview_screen.dart';
import 'package:machinery/feature/finance/presentation/pages/transaction_form_screen.dart';
import 'package:machinery/feature/home/data/logic/home_block_kind.dart';
import 'package:machinery/feature/home/data/logic/home_dashboard_cubit.dart';
import 'package:machinery/feature/home/data/logic/home_dashboard_state.dart';
import 'package:machinery/feature/home/presentation/widgets/home_block_card.dart';
import 'package:machinery/feature/home/presentation/widgets/home_quick_actions.dart';
import 'package:machinery/feature/machines/data/logic/machines_list/machines_list_cubit.dart';
import 'package:machinery/feature/machines/presentation/pages/machines_list_screen.dart';
import 'package:machinery/feature/merchants/data/logic/merchants_list/merchants_list_cubit.dart';
import 'package:machinery/feature/merchants/presentation/pages/merchants_list_screen.dart';
import 'package:machinery/feature/more/presentation/widgets/more_profile_header.dart';
import 'package:machinery/feature/transfers/data/logic/transfers_list/transfers_list_cubit.dart';
import 'package:machinery/feature/transfers/presentation/pages/transfers_list_screen.dart';

/// The Home tab. Every block on it is gated on the permission that owns the
/// data it shows — never on a role name — so a Director and a representative
/// run the exact same build method and simply end up with a different number
/// of cards.
class HomeDashboardScreen extends StatefulWidget {
  const HomeDashboardScreen({super.key});

  @override
  State<HomeDashboardScreen> createState() => _HomeDashboardScreenState();
}

class _HomeDashboardScreenState extends State<HomeDashboardScreen> {
  final PermissionService _permissionService = getIt<PermissionService>();

  @override
  void initState() {
    super.initState();
    context.read<HomeDashboardCubit>().load();
  }

  Future<void> _open(Widget page) async {
    await Navigator.push<Object?>(
      context,
      MaterialPageRoute<Object?>(builder: (_) => page),
    );
    if (mounted) {
      context.read<HomeDashboardCubit>().load();
    }
  }

  Future<void> _scanMachine() async {
    final result = await AppRoute.goToScanner(context);
    if (result == null || !mounted) return;
    await AppRoute.goToMachineDetail(
      context: context,
      machineId: result.machine.id,
      initial: result.machine,
    );
    if (mounted) context.read<HomeDashboardCubit>().load();
  }

  String? _lastUpdatedCaption() {
    final DateTime? syncedAt = DateTime.tryParse(LocalStorage.getLastSyncedAt());
    if (syncedAt == null) return null;
    return LocaleKeys.homeLastUpdated.tr(args: <String>[Formatters.relative(syncedAt)]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(LocaleKeys.navHome.tr())),
      body: BlocBuilder<AuthCubit, AuthState>(
        builder: (context, authState) {
          if (authState is! Authenticated) {
            return const Center(child: AppLoadingIndicator());
          }

          return BlocBuilder<HomeDashboardCubit, HomeDashboardState>(
            builder: (context, state) {
              return RefreshIndicator(
                onRefresh: () => context.read<HomeDashboardCubit>().load(),
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                  children: <Widget>[
                    MoreProfileHeader(user: authState.profile.user),
                    const SizedBox(height: AppSpacing.lg),
                    ..._quickActionsSection(context),
                    Text(
                      LocaleKeys.homeOverviewSection.tr(),
                      style: Styles.s16(context),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    if (state is HomeDashboardLoaded)
                      _overviewGrid(context, state)
                    else
                      const Padding(
                        padding: EdgeInsetsDirectional.only(top: AppSpacing.xl),
                        child: AppLoadingIndicator(),
                      ),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  List<Widget> _quickActionsSection(BuildContext context) {
    final List<HomeQuickAction> actions = <HomeQuickAction>[
      if (_permissionService.has(P.machinesRead))
        HomeQuickAction(
          identifier: 'home_action_scan',
          label: LocaleKeys.scanTitle.tr(),
          icon: Icons.qr_code_scanner_rounded,
          onTap: _scanMachine,
        ),
      if (_permissionService.has(P.transfersCreate))
        HomeQuickAction(
          identifier: 'home_action_create_transfer',
          label: LocaleKeys.transferCreateTitle.tr(),
          icon: Icons.swap_horiz_rounded,
          onTap: () => AppRoute.goToCreateTransfer(context),
        ),
      if (_permissionService.has(P.merchantsCreate))
        HomeQuickAction(
          identifier: 'home_action_register_merchant',
          label: LocaleKeys.merchantRegisterTitle.tr(),
          icon: Icons.storefront_rounded,
          onTap: () => AppRoute.goToMerchantForm(context: context),
        ),
      if (_permissionService.has(P.machinesCreate))
        HomeQuickAction(
          identifier: 'home_action_add_machine',
          label: LocaleKeys.machineAddTitle.tr(),
          icon: Icons.add_box_rounded,
          onTap: () => AppRoute.goToMachineForm(context: context),
        ),
      if (_permissionService.has(P.financeCreate))
        HomeQuickAction(
          identifier: 'home_action_add_transaction',
          label: LocaleKeys.financeAddTransaction.tr(),
          icon: Icons.receipt_long_rounded,
          onTap: () => _open(const TransactionFormScreen()),
        ),
    ];

    if (actions.isEmpty) {
      return const <Widget>[];
    }

    return <Widget>[
      Text(LocaleKeys.homeQuickActionsSection.tr(), style: Styles.s16(context)),
      const SizedBox(height: AppSpacing.sm),
      HomeQuickActions(actions: actions),
      const SizedBox(height: AppSpacing.lg),
    ];
  }

  Widget _overviewGrid(BuildContext context, HomeDashboardLoaded state) {
    final HomeDashboardCubit cubit = context.read<HomeDashboardCubit>();
    final String? updatedCaption = _lastUpdatedCaption();
    final String offlineText = LocaleKeys.homeBlockOffline.tr();
    final String retryTooltip = LocaleKeys.tryAgain.tr();

    final List<Widget> cards = <Widget>[
      if (state.machines != null)
        HomeBlockCard(
          title: LocaleKeys.navMachines.tr(),
          icon: Icons.precision_manufacturing_rounded,
          color: AppColors.infoColor,
          availability: state.machines!.availability,
          offlineText: offlineText,
          retryTooltip: retryTooltip,
          valueText: state.machines!.data != null
              ? Formatters.number(state.machines!.data!.total)
              : null,
          subtitle: LocaleKeys.homeInYourScope.tr(),
          updatedCaption: state.machines!.isFromCache ? updatedCaption : null,
          errorMessage: state.machines!.errorMessage,
          onTap: () => _open(_wrappedMachinesList()),
          onRetry: () => cubit.retry(HomeBlockKind.machines),
        ),
      if (state.transfers != null)
        HomeBlockCard(
          title: LocaleKeys.navTransfers.tr(),
          icon: Icons.swap_horiz_rounded,
          color: AppColors.warningColor,
          availability: state.transfers!.availability,
          offlineText: offlineText,
          retryTooltip: retryTooltip,
          valueText: state.transfers!.data != null
              ? Formatters.number(state.transfers!.data!.pendingForMe)
              : null,
          subtitle: LocaleKeys.homeTransfersSubtitle.tr(),
          updatedCaption: state.transfers!.isFromCache ? updatedCaption : null,
          errorMessage: state.transfers!.errorMessage,
          onTap: () => _open(_wrappedTransfersList()),
          onRetry: () => cubit.retry(HomeBlockKind.transfers),
        ),
      if (state.merchants != null)
        HomeBlockCard(
          title: LocaleKeys.navMerchants.tr(),
          icon: Icons.storefront_rounded,
          color: AppColors.successColor,
          availability: state.merchants!.availability,
          offlineText: offlineText,
          retryTooltip: retryTooltip,
          valueText: state.merchants!.data != null
              ? Formatters.number(state.merchants!.data!.total)
              : null,
          subtitle: LocaleKeys.homeInYourScope.tr(),
          updatedCaption: state.merchants!.isFromCache ? updatedCaption : null,
          errorMessage: state.merchants!.errorMessage,
          onTap: () => _open(_wrappedMerchantsList()),
          onRetry: () => cubit.retry(HomeBlockKind.merchants),
        ),
      if (state.violations != null)
        HomeBlockCard(
          title: LocaleKeys.violationsTitle.tr(),
          icon: Icons.gavel_rounded,
          color: AppColors.dangerColor,
          availability: state.violations!.availability,
          offlineText: offlineText,
          retryTooltip: retryTooltip,
          valueText: state.violations!.data != null
              ? Formatters.number(state.violations!.data!.open)
              : null,
          subtitle: LocaleKeys.homeViolationsSubtitle.tr(),
          errorMessage: state.violations!.errorMessage,
          onTap: () => AppRoute.goToViolationsList(context: context),
          onRetry: () => cubit.retry(HomeBlockKind.violations),
        ),
      if (state.maintenance != null)
        HomeBlockCard(
          title: LocaleKeys.homeMaintenanceTitle.tr(),
          icon: Icons.build_circle_rounded,
          color: AppColors.neutralColor,
          availability: state.maintenance!.availability,
          offlineText: offlineText,
          retryTooltip: retryTooltip,
          valueText: state.maintenance!.data != null
              ? Formatters.number(state.maintenance!.data!.open)
              : null,
          subtitle: LocaleKeys.homeMaintenanceSubtitle.tr(),
          errorMessage: state.maintenance!.errorMessage,
          onTap: () => AppRoute.goToFeatureNotReadyScreen(
            context: context,
            titleKey: LocaleKeys.homeMaintenanceTitle,
            icon: Icons.build_circle_rounded,
          ),
          onRetry: () => cubit.retry(HomeBlockKind.maintenance),
        ),
      if (state.finance != null)
        HomeBlockCard(
          title: LocaleKeys.navFinance.tr(),
          icon: Icons.account_balance_wallet_rounded,
          color: _financeColor(state.finance!.data),
          availability: state.finance!.availability,
          offlineText: offlineText,
          retryTooltip: retryTooltip,
          valueText: state.finance!.data != null
              ? Formatters.currency(state.finance!.data!.net)
              : null,
          subtitle: state.finance!.data != null
              ? LocaleKeys.homeFinanceSubtitle.tr(
                  args: <String>[
                    Formatters.currency(state.finance!.data!.income),
                    Formatters.currency(state.finance!.data!.expense),
                  ],
                )
              : null,
          errorMessage: state.finance!.errorMessage,
          onTap: () => _open(_wrappedFinanceOverview()),
          onRetry: () => cubit.retry(HomeBlockKind.finance),
        ),
      if (state.budgets != null)
        HomeBlockCard(
          title: LocaleKeys.financeBudgets.tr(),
          icon: Icons.speed_outlined,
          color: _budgetsColor(state.budgets!.data),
          availability: state.budgets!.availability,
          offlineText: offlineText,
          retryTooltip: retryTooltip,
          valueText: state.budgets!.data != null
              ? Formatters.number(
                  state.budgets!.data!.warningCount +
                      state.budgets!.data!.exceededCount,
                )
              : null,
          subtitle: LocaleKeys.homeBudgetsSubtitle.tr(),
          errorMessage: state.budgets!.errorMessage,
          onTap: () => _open(const BudgetsScreen(query: FinanceQuery())),
          onRetry: () => cubit.retry(HomeBlockKind.budgets),
        ),
    ];

    if (cards.isEmpty) {
      return Padding(
        padding: const EdgeInsetsDirectional.symmetric(vertical: AppSpacing.lg),
        child: Text(
          LocaleKeys.homeNoBlocksAvailable.tr(),
          textAlign: TextAlign.center,
          style: Styles.s14(context).copyWith(color: AppColors.textSecondaryColor),
        ),
      );
    }

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: AppSpacing.sm,
      crossAxisSpacing: AppSpacing.sm,
      childAspectRatio: 1.3,
      children: cards,
    );
  }

  Color _financeColor(FinanceSummary? summary) {
    if (summary == null) return AppColors.infoColor;
    return summary.net >= 0 ? AppColors.infoColor : AppColors.dangerColor;
  }

  Color _budgetsColor(BudgetStatusList? status) {
    if (status == null) return AppColors.warningColor;
    return status.exceededCount > 0 ? AppColors.dangerColor : AppColors.warningColor;
  }

  Widget _wrappedMachinesList() => BlocProvider<MachinesListCubit>(
    create: (_) => getIt<MachinesListCubit>(),
    child: const MachinesListScreen(),
  );

  Widget _wrappedTransfersList() => BlocProvider<TransfersListCubit>(
    create: (_) => getIt<TransfersListCubit>(),
    child: const TransfersListScreen(),
  );

  Widget _wrappedMerchantsList() => BlocProvider<MerchantsListCubit>(
    create: (_) => getIt<MerchantsListCubit>(),
    child: const MerchantsListScreen(),
  );

  Widget _wrappedFinanceOverview() => BlocProvider<FinanceOverviewCubit>(
    create: (_) => getIt<FinanceOverviewCubit>(),
    child: const FinanceOverviewScreen(),
  );
}
