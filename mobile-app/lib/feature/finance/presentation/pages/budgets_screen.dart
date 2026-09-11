import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
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
  List<FinanceBudget>? _budgets;
  BudgetStatusList? _status;
  String? _error;
  bool get _manage => getIt<PermissionService>().has(P.financeBudgetsManage);
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final results = await (
      _repo.budgets(widget.query),
      _repo.budgetStatus(widget.query),
    ).wait;
    if (!mounted) return;
    final failure = results.$1.fold(
      (f) => f,
      (_) => results.$2.fold((f) => f, (_) => null),
    );
    if (failure != null) {
      setState(() => _error = failure.errorMessage);
    } else {
      setState(() {
        _budgets = results.$1.getOrElse(() => const []);
        _status = results.$2.getOrElse(
          () => BudgetStatusList(asOf: DateTime.now(), budgets: const []),
        );
        _error = null;
      });
    }
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
        : _budgets == null || _status == null
        ? const AppLoadingIndicator()
        : _budgets!.isEmpty && _status!.budgets.isEmpty
        ? AppEmptyState(
            icon: Icons.speed_outlined,
            title: LocaleKeys.financeNoBudgets.tr(),
            subtitle: LocaleKeys.financeNoBudgetsSubtitle.tr(),
          )
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              children: <Widget>[
                ..._status!.budgets.map((b) => BudgetStatusCard(budget: b)),
                if (_status!.budgets.isNotEmpty && _budgets!.isNotEmpty)
                  const SizedBox(height: AppSpacing.sm),
                if (_status!.budgets.isNotEmpty && _budgets!.isNotEmpty)
                  const Divider(),
                ..._budgets!.map(
                  (b) => Card(
                    child: ListTile(
                      onTap: _manage ? () => _form(b) : null,
                      title: Text(
                        b.category.path.isEmpty
                            ? b.category.name
                            : b.category.path,
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
                const SizedBox(height: 72),
              ],
            ),
          ),
  );
}
