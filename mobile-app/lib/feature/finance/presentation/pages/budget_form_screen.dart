import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';
import 'package:machinery/feature/finance/presentation/pages/category_picker_screen.dart';
import 'package:machinery/feature/finance/presentation/widgets/finance_widgets.dart';

class BudgetFormScreen extends StatefulWidget {
  const BudgetFormScreen({super.key, this.existing});
  final FinanceBudget? existing;
  @override
  State<BudgetFormScreen> createState() => _BudgetFormScreenState();
}

class _BudgetFormScreenState extends State<BudgetFormScreen> {
  final FinanceRepo _repo = getIt<FinanceRepo>();
  final _key = GlobalKey<FormState>();
  late final _amount = TextEditingController(
    text: widget.existing?.amount.toString(),
  );
  late final _threshold = TextEditingController(
    text: (widget.existing?.alertThresholdPercent ?? 80).toString(),
  );
  FinanceCategory? _category;
  late String _periodType = widget.existing?.periodType ?? 'MONTHLY';
  late DateTime _start =
      widget.existing?.periodStart ??
      DateTime(DateTime.now().year, DateTime.now().month);
  late DateTime _end =
      widget.existing?.periodEnd ??
      DateTime(
        DateTime.now().year,
        DateTime.now().month + 1,
      ).subtract(const Duration(days: 1));
  late bool _include = widget.existing?.includeSubcategories ?? true;
  late bool _renew = widget.existing?.autoRenew ?? false;
  bool _saving = false;
  Future<void> _pickCategory() async {
    final value = await Navigator.push<FinanceCategory>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            CategoryPickerScreen(repo: _repo, kind: FinanceKind.expense),
      ),
    );
    if (value != null) setState(() => _category = value);
  }

  Future<void> _date(bool start) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: start ? _start : _end,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked != null) {
      setState(() {
        if (start) {
          _start = picked;
        } else {
          _end = picked;
        }
      });
    }
  }

  Future<void> _save() async {
    if (!_key.currentState!.validate() ||
        (_category == null && widget.existing == null) ||
        _end.isBefore(_start)) {
      return;
    }
    setState(() => _saving = true);
    final draft = BudgetDraft(
      categoryId: _category?.id ?? widget.existing!.category.id,
      periodType: _periodType,
      periodStart: _start,
      periodEnd: _end,
      amount: double.parse(_amount.text),
      branchId: widget.existing?.branch?.id,
      alertThresholdPercent: int.parse(_threshold.text),
      includeSubcategories: _include,
      autoRenew: _renew,
    );
    final result = widget.existing == null
        ? await _repo.createBudget(draft)
        : await _repo.updateBudget(widget.existing!.id, draft);
    if (!mounted) return;
    setState(() => _saving = false);
    result.fold(
      (f) => showErrorToast(f.errorMessage, context),
      (_) => Navigator.pop(context, true),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        widget.existing == null
            ? LocaleKeys.financeAddBudget.tr()
            : LocaleKeys.financeEditBudget.tr(),
      ),
    ),
    body: Form(
      key: _key,
      child: ListView(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        children: <Widget>[
          ListTile(
            shape: RoundedRectangleBorder(
              side: BorderSide(color: Theme.of(context).dividerColor),
              borderRadius: BorderRadius.circular(12),
            ),
            title: Text(LocaleKeys.financeExpenseCategory.tr()),
            subtitle: Text(
              _category?.name ??
                  widget.existing?.category.path ??
                  LocaleKeys.financeChooseCategory.tr(),
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: widget.existing == null ? _pickCategory : null,
          ),
          const SizedBox(height: AppSpacing.md),
          DropdownButtonFormField<String>(
            initialValue: _periodType,
            decoration: InputDecoration(labelText: LocaleKeys.financePeriod.tr()),
            items: const <String>[
              'MONTHLY',
              'QUARTERLY',
              'YEARLY',
              'CUSTOM',
            ]
                .map(
                  (v) => DropdownMenuItem(
                    value: v,
                    child: Text(localizedPeriodType(v)),
                  ),
                )
                .toList(),
            onChanged: widget.existing == null
                ? (v) => setState(() => _periodType = v!)
                : null,
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton(
                  onPressed: widget.existing == null ? () => _date(true) : null,
                  child: LtrText(
                    LocaleKeys.financeFromDate.tr(
                      args: <String>[financeDate(_start)],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: widget.existing == null
                      ? () => _date(false)
                      : null,
                  child: LtrText(
                    LocaleKeys.financeToDate.tr(
                      args: <String>[financeDate(_end)],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: _amount,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: LocaleKeys.financeBudgetAmount.tr(),
            ),
            validator: (v) => (double.tryParse(v ?? '') ?? 0) <= 0
                ? LocaleKeys.thisFieldIsNotMinusOrZero.tr()
                : null,
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: _threshold,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: LocaleKeys.financeWarningThreshold.tr(),
            ),
            validator: (v) {
              final n = int.tryParse(v ?? '');
              return n == null || n < 1 || n > 100
                  ? LocaleKeys.financeThresholdRange.tr()
                  : null;
            },
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(LocaleKeys.financeIncludeSubcategories.tr()),
            value: _include,
            onChanged: (v) => setState(() => _include = v),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(LocaleKeys.financeAutoRenew.tr()),
            value: _renew,
            onChanged: (v) => setState(() => _renew = v),
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(
              _saving
                  ? LocaleKeys.financeSaving.tr()
                  : LocaleKeys.financeSaveBudget.tr(),
            ),
          ),
        ],
      ),
    ),
  );
}
