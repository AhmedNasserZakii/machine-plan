import 'package:dartz/dartz.dart' hide State;
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';
import 'package:machinery/feature/finance/presentation/pages/budget_form_screen.dart';
import 'package:machinery/feature/finance/presentation/widgets/finance_widgets.dart';

class BudgetsScreen extends StatefulWidget {
  const BudgetsScreen({required this.query, super.key});
  final FinanceQuery query;
  @override
  State<BudgetsScreen> createState() => _BudgetsScreenState();
}

class _BudgetsScreenState extends State<BudgetsScreen> {
  final FinanceRepo _repo = getIt<FinanceRepo>();
  List<FinanceBudget> _budgets = const <FinanceBudget>[];
  List<FinanceBudgetStatus> _status = const <FinanceBudgetStatus>[];
  String? _error;
  bool _loading = true;
  bool _loadingMore = false;
  int _page = 1;
  bool _hasNext = false;
  bool get _manage => getIt<PermissionService>().has(P.financeBudgetsManage);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final results = await (
      _repo.budgetStatus(widget.query),
      _repo.budgets(widget.query, page: 1),
    ).wait;
    if (!mounted) return;
    _apply(
      statusResult: results.$1,
      budgetsResult: results.$2,
      page: 1,
      replace: true,
    );
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasNext) return;
    setState(() => _loadingMore = true);
    final Either<ServerFailure, FinanceBudgetsPage> result =
        await _repo.budgets(widget.query, page: _page + 1);
    if (!mounted) return;
    _apply(budgetsResult: result, page: _page + 1, replace: false);
  }

  void _apply({
    required Either<ServerFailure, FinanceBudgetsPage> budgetsResult,
    required int page,
    required bool replace,
    Either<ServerFailure, BudgetStatusList>? statusResult,
  }) {
    final ServerFailure? failure = budgetsResult.fold((f) => f, (_) => null) ??
        statusResult?.fold((f) => f, (_) => null);
    if (failure != null) {
      setState(() {
        _error = failure.errorMessage;
        _loading = false;
        _loadingMore = false;
      });
      return;
    }

    final FinanceBudgetsPage budgetsPage = budgetsResult.getOrElse(
      () => throw StateError('budgets'),
    );

    setState(() {
      _budgets = replace
          ? budgetsPage.items
          : <FinanceBudget>[..._budgets, ...budgetsPage.items];
      if (statusResult != null) {
        _status = statusResult
            .getOrElse(
              () => BudgetStatusList(asOf: DateTime.now(), budgets: const []),
            )
            .budgets;
      }
      _page = page;
      _hasNext = budgetsPage.meta.hasNext;
      _error = null;
      _loading = false;
      _loadingMore = false;
    });
  }

  Future<void> _form([FinanceBudget? budget]) async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => BudgetFormScreen(existing: budget)),
    );
    if (changed == true) _load();
  }

  Future<void> _delete(FinanceBudget budget) async {
    if (!await AppConfirmDialog.show(
      context: context,
      title: LocaleKeys.financeDeleteBudgetTitle.tr(),
      description: LocaleKeys.financeDeleteBudgetBody.tr(),
      isDestructive: true,
    )) {
      return;
    }
    final result = await _repo.deleteBudget(budget.id);
    if (!mounted) return;
    result.fold((f) => showErrorToast(f.errorMessage, context), (_) => _load());
  }

  String _budgetSubtitle(FinanceBudget budget) {
    final String detail = budget.includeSubcategories
        ? LocaleKeys.financeIncludeSubcategories.tr()
        : LocaleKeys.financeDirectSpendOnly.tr();
    final String inactive = budget.isActive
        ? ''
        : ' • ${LocaleKeys.userInactive.tr()}';
    return '${localizedPeriodType(budget.periodType)} • ${financeDate(budget.periodStart)} – ${financeDate(budget.periodEnd)}\n$detail$inactive';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(LocaleKeys.financeBudgets.tr())),
    floatingActionButton: _manage
        ? FloatingActionButton(onPressed: _form, child: const Icon(Icons.add))
        : null,
    body: _error != null
        ? AppErrorView(message: _error!, onRetry: _load)
        : _loading
        ? const AppLoadingIndicator()
        : _budgets.isEmpty && _status.isEmpty
        ? AppEmptyState(
            icon: Icons.speed_outlined,
            title: LocaleKeys.financeNoBudgets.tr(),
            subtitle: LocaleKeys.financeNoBudgetsSubtitle.tr(),
          )
        : PaginatedListView<FinanceBudget>(
            items: _budgets,
            hasNext: _hasNext,
            isLoadingMore: _loadingMore,
            onRefresh: _load,
            onLoadMore: _loadMore,
            header: _status.isEmpty
                ? null
                : Column(
                    children: <Widget>[
                      ..._status.map((b) => BudgetStatusCard(budget: b)),
                      if (_budgets.isNotEmpty) ...<Widget>[
                        const SizedBox(height: AppSpacing.sm),
                        const Divider(),
                        const SizedBox(height: AppSpacing.sm),
                      ],
                    ],
                  ),
            itemBuilder: (context, b, _) => Card(
              child: ListTile(
                onTap: _manage ? () => _form(b) : null,
                title: Text(
                  b.category.path.isEmpty ? b.category.name : b.category.path,
                ),
                subtitle: LtrText(_budgetSubtitle(b)),
                trailing: _manage
                    ? IconButton(
                        onPressed: () => _delete(b),
                        icon: const Icon(Icons.delete_outline),
                      )
                    : LtrText(formatMoney(context, b.amount)),
              ),
            ),
          ),
  );
}
