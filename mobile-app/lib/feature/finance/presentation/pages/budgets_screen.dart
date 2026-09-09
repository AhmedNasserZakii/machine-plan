import 'package:flutter/material.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/app_confirm_dialog.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
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
      title: 'Delete budget?',
      description: 'Transactions are not affected.',
      isDestructive: true,
    )) {
      return;
    }
    final result = await _repo.deleteBudget(budget.id);
    if (!mounted) return;
    result.fold((f) => showErrorToast(f.errorMessage, context), (_) => _load());
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Budgets')),
    floatingActionButton: _manage
        ? FloatingActionButton(onPressed: _form, child: const Icon(Icons.add))
        : null,
    body: _error != null
        ? AppErrorView(message: _error!, onRetry: _load)
        : _budgets == null || _status == null
        ? const AppLoadingIndicator()
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              children: <Widget>[
                ..._status!.budgets.map((b) => BudgetStatusCard(budget: b)),
                const SizedBox(height: AppSpacing.sm),
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
                      subtitle: Text(
                        '${b.periodType} • ${financeDate(b.periodStart)} – ${financeDate(b.periodEnd)}\n${b.includeSubcategories ? 'Includes subcategories' : 'Direct spend only'}${b.isActive ? '' : ' • Inactive'}',
                      ),
                      trailing: _manage
                          ? IconButton(
                              onPressed: () => _delete(b),
                              icon: const Icon(Icons.delete_outline),
                            )
                          : Text(formatMoney(context, b.amount)),
                    ),
                  ),
                ),
                const SizedBox(height: 72),
              ],
            ),
          ),
  );
}
