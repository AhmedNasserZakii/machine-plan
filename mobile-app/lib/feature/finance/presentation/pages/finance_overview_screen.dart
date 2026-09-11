import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/finance/data/logic/finance_overview/finance_overview_cubit.dart';
import 'package:machinery/feature/finance/data/logic/finance_overview/finance_overview_state.dart';
import 'package:machinery/feature/finance/data/logic/transactions/finance_transactions_cubit.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:machinery/feature/finance/presentation/pages/budgets_screen.dart';
import 'package:machinery/feature/finance/presentation/pages/category_breakdown_screen.dart';
import 'package:machinery/feature/finance/presentation/pages/category_management_screen.dart';
import 'package:machinery/feature/finance/presentation/pages/finance_transactions_screen.dart';
import 'package:machinery/feature/finance/presentation/pages/transaction_form_screen.dart';
import 'package:machinery/feature/finance/presentation/widgets/finance_widgets.dart';

class FinanceOverviewScreen extends StatefulWidget {
  const FinanceOverviewScreen({super.key});

  @override
  State<FinanceOverviewScreen> createState() => _FinanceOverviewScreenState();
}

class _FinanceOverviewScreenState extends State<FinanceOverviewScreen> {
  @override
  void initState() {
    super.initState();
    context.read<FinanceOverviewCubit>().load();
  }

  Future<void> _open(Widget page) async {
    await Navigator.push<Object?>(
      context,
      MaterialPageRoute<Object?>(builder: (_) => page),
    );
    if (mounted) {
      context.read<FinanceOverviewCubit>().load(showLoader: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(LocaleKeys.financeTitle.tr()),
        actions: <Widget>[
          if (getIt<PermissionService>().has(P.financeCategoriesManage))
            IconButton(
              tooltip: LocaleKeys.financeCategories.tr(),
              onPressed: () => _open(const CategoryManagementScreen()),
              icon: const Icon(Icons.account_tree_outlined),
            ),
        ],
      ),
      floatingActionButton: getIt<PermissionService>().has(P.financeCreate)
          ? FloatingActionButton.extended(
              onPressed: () => _open(const TransactionFormScreen()),
              icon: const Icon(Icons.add),
              label: Text(LocaleKeys.financeAddTransaction.tr()),
            )
          : null,
      body: BlocBuilder<FinanceOverviewCubit, FinanceOverviewState>(
        builder: (BuildContext context, FinanceOverviewState state) {
          if (state is FinanceOverviewFailure) {
            return AppErrorView(
              message: state.message,
              onRetry: () => context.read<FinanceOverviewCubit>().load(),
            );
          }
          if (state is! FinanceOverviewLoaded) {
            return const AppLoadingIndicator();
          }
          return _loaded(context, state);
        },
      ),
    );
  }

  Widget _loaded(BuildContext context, FinanceOverviewLoaded state) {
    return RefreshIndicator(
      onRefresh: () =>
          context.read<FinanceOverviewCubit>().load(showLoader: false),
      child: ListView(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        children: <Widget>[
          _Filters(
            state: state,
            onChanged: (FinanceQuery query) => context
                .read<FinanceOverviewCubit>()
                .load(query: query, showLoader: false),
          ),
          if (state.pendingCount > 0)
            Container(
              margin: const EdgeInsetsDirectional.only(top: AppSpacing.sm),
              padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
              color: AppColors.warningSurfaceColor,
              child: Text(
                LocaleKeys.financePendingTransactions.tr(
                  args: <String>[state.pendingCount.toString()],
                ),
              ),
            ),
          const SizedBox(height: AppSpacing.md),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: AppSpacing.sm,
            crossAxisSpacing: AppSpacing.sm,
            childAspectRatio: 1.55,
            children: <Widget>[
              FinanceMetricCard(
                label: LocaleKeys.financeIncome.tr(),
                value: formatMoney(context, state.summary.income),
                color: AppColors.successColor,
                icon: Icons.trending_up,
              ),
              FinanceMetricCard(
                label: LocaleKeys.financeExpense.tr(),
                value: formatMoney(context, state.summary.expense),
                color: AppColors.dangerColor,
                icon: Icons.trending_down,
              ),
              FinanceMetricCard(
                label: LocaleKeys.financeNet.tr(),
                value: formatMoney(context, state.summary.net),
                color: state.summary.net >= 0
                    ? AppColors.infoColor
                    : AppColors.dangerColor,
                icon: Icons.balance,
              ),
              FinanceMetricCard(
                label: LocaleKeys.financeBudgetAlerts.tr(),
                value:
                    '${state.budgets.warningCount + state.budgets.exceededCount}',
                color: state.budgets.exceededCount > 0
                    ? AppColors.dangerColor
                    : AppColors.warningColor,
                icon: Icons.speed,
                ltrValue: false,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: <Widget>[
              FilledButton.tonalIcon(
                onPressed: () => _open(
                  BlocProvider<FinanceTransactionsCubit>(
                    create: (_) => getIt<FinanceTransactionsCubit>(),
                    child: FinanceTransactionsScreen(
                      initialQuery: TransactionQuery(
                        dateFrom: state.query.dateFrom,
                        dateTo: state.query.dateTo,
                        branchId: state.query.branchId,
                      ),
                    ),
                  ),
                ),
                icon: const Icon(Icons.receipt_long_outlined),
                label: Text(LocaleKeys.financeTransactions.tr()),
              ),
              FilledButton.tonalIcon(
                onPressed: () =>
                    _open(CategoryBreakdownScreen(query: state.query)),
                icon: const Icon(Icons.donut_small_outlined),
                label: Text(LocaleKeys.financeBreakdown.tr()),
              ),
              FilledButton.tonalIcon(
                onPressed: () => _open(BudgetsScreen(query: state.query)),
                icon: const Icon(Icons.speed_outlined),
                label: Text(LocaleKeys.financeBudgets.tr()),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          ...state.budgets.budgets
              .take(3)
              .map((b) => BudgetStatusCard(budget: b)),
          const SizedBox(height: 80),
        ],
      ),
    );
  }
}

class _Filters extends StatelessWidget {
  const _Filters({required this.state, required this.onChanged});
  final FinanceOverviewLoaded state;
  final ValueChanged<FinanceQuery> onChanged;
  @override
  Widget build(BuildContext context) => Row(
    children: <Widget>[
      Expanded(
        child: OutlinedButton.icon(
          onPressed: () async {
            final range = await showDateRangePicker(
              context: context,
              firstDate: DateTime(2020),
              lastDate: DateTime.now(),
            );
            if (range != null) {
              onChanged(
                FinanceQuery(
                  dateFrom: range.start,
                  dateTo: range.end,
                  branchId: state.query.branchId,
                ),
              );
            }
          },
          icon: const Icon(Icons.date_range),
          label: Text(
            state.query.dateFrom == null
                ? LocaleKeys.financeDateRange.tr()
                : '${financeDate(state.query.dateFrom!)} – ${financeDate(state.query.dateTo!)}',
          ),
        ),
      ),
      if (getIt<PermissionService>().has(P.financeReadAll)) ...<Widget>[
        const SizedBox(width: AppSpacing.sm),
        PopupMenuButton<String?>(
          tooltip: LocaleKeys.financeBranch.tr(),
          icon: const Icon(Icons.business_outlined),
          onSelected: (id) => onChanged(
            FinanceQuery(
              dateFrom: state.query.dateFrom,
              dateTo: state.query.dateTo,
              branchId: id,
            ),
          ),
          itemBuilder: (_) => <PopupMenuEntry<String?>>[
            PopupMenuItem<String?>(
              value: null,
              child: Text(LocaleKeys.all.tr()),
            ),
            ...state.branches.map(
              (b) => PopupMenuItem<String?>(value: b.id, child: Text(b.name)),
            ),
          ],
        ),
      ],
    ],
  );
}
