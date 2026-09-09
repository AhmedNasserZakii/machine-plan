import 'package:flutter/material.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';
import 'package:machinery/feature/finance/presentation/pages/category_picker_screen.dart';

class TransactionFormScreen extends StatefulWidget {
  const TransactionFormScreen({super.key, this.existing});
  final FinanceTransaction? existing;
  @override
  State<TransactionFormScreen> createState() => _TransactionFormScreenState();
}

class _TransactionFormScreenState extends State<TransactionFormScreen> {
  final FinanceRepo _repo = getIt<FinanceRepo>();
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _amount = TextEditingController(
    text: widget.existing?.amount.toString(),
  );
  late final TextEditingController _notes = TextEditingController(
    text: widget.existing?.notes,
  );
  late FinanceKind _kind = widget.existing?.kind ?? FinanceKind.expense;
  late DateTime _date = widget.existing?.transactionDate ?? DateTime.now();
  FinanceCategory? _category;
  String? _paymentId;
  String? _branchId;
  String? _supplierId;
  List<FinanceRef>? _payments;
  List<FinanceRef> _branches = const [];
  List<FinanceRef> _suppliers = const [];
  bool _saving = false;
  String? _loadError;
  @override
  void initState() {
    super.initState();
    _loadRefs();
  }

  Future<void> _loadRefs() async {
    final results = await (
      _repo.paymentMethods(),
      _repo.branches(),
      _repo.suppliers(),
    ).wait;
    if (!mounted) return;
    // Branch and supplier are optional. Missing optional caches must not
    // prevent a field worker from recording a transaction offline.
    final failure = results.$1.fold((f) => f, (_) => null);
    if (failure != null) {
      setState(() => _loadError = failure.errorMessage);
      return;
    }
    setState(() {
      _payments = results.$1.getOrElse(() => const <FinanceRef>[]);
      _branches = results.$2.getOrElse(() => const <FinanceRef>[]);
      _suppliers = results.$3.getOrElse(() => const <FinanceRef>[]);
      _paymentId =
          widget.existing?.paymentMethod.id ??
          (_payments!.isEmpty ? null : _payments!.first.id);
      _branchId = widget.existing?.branch?.id;
      _supplierId = widget.existing?.supplier?.id;
    });
  }

  Future<void> _pickCategory() async {
    final picked = await Navigator.push<FinanceCategory>(
      context,
      MaterialPageRoute(
        builder: (_) => CategoryPickerScreen(repo: _repo, kind: _kind),
      ),
    );
    if (picked != null) setState(() => _category = picked);
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() ||
        (_category == null && widget.existing == null) ||
        _paymentId == null) {
      setState(() {});
      return;
    }
    setState(() => _saving = true);
    final draft = TransactionDraft(
      kind: _kind,
      amount: double.parse(_amount.text),
      categoryId: _category?.id ?? widget.existing!.category.id,
      transactionDate: _date,
      paymentMethodId: _paymentId!,
      branchId: _branchId,
      supplierId: _supplierId,
      notes: _notes.text,
    );
    final result = widget.existing == null
        ? await _repo.createTransaction(draft)
        : await _repo.updateTransaction(widget.existing!.id, draft);
    if (!mounted) return;
    setState(() => _saving = false);
    result.fold((f) => showErrorToast(f.errorMessage, context), (row) {
      showSuccessToast(
        row.isPendingSync
            ? 'Saved locally, it will upload when you are back online'
            : 'Transaction saved',
        context,
      );
      Navigator.pop(context, row);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_payments == null) {
      return Scaffold(
        appBar: AppBar(
          title: Text(
            widget.existing == null ? 'Add transaction' : 'Edit transaction',
          ),
        ),
        body: _loadError == null
            ? const AppLoadingIndicator()
            : Center(child: Text(_loadError!)),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.existing == null ? 'Add transaction' : 'Edit transaction',
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          children: <Widget>[
            if (widget.existing == null)
              SegmentedButton<FinanceKind>(
                segments: const [
                  ButtonSegment(
                    value: FinanceKind.expense,
                    label: Text('Expense'),
                    icon: Icon(Icons.north_east),
                  ),
                  ButtonSegment(
                    value: FinanceKind.income,
                    label: Text('Income'),
                    icon: Icon(Icons.south_west),
                  ),
                ],
                selected: <FinanceKind>{_kind},
                onSelectionChanged: (value) => setState(() {
                  _kind = value.first;
                  _category = null;
                }),
              ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _amount,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Amount (EGP)',
                prefixIcon: Icon(Icons.payments_outlined),
              ),
              validator: (value) => (double.tryParse(value ?? '') ?? 0) <= 0
                  ? 'Enter an amount greater than zero'
                  : null,
            ),
            const SizedBox(height: AppSpacing.md),
            ListTile(
              shape: RoundedRectangleBorder(
                side: BorderSide(
                  color: _category == null && widget.existing == null
                      ? Theme.of(context).colorScheme.error
                      : Theme.of(context).dividerColor,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              leading: const Icon(Icons.category_outlined),
              title: const Text('Category'),
              subtitle: Text(
                _category?.name ??
                    widget.existing?.category.path ??
                    'Choose a matching category',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: _pickCategory,
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _paymentId,
              decoration: const InputDecoration(labelText: 'Payment method'),
              items: _payments!
                  .map(
                    (p) => DropdownMenuItem(value: p.id, child: Text(p.name)),
                  )
                  .toList(),
              onChanged: (value) => setState(() => _paymentId = value),
              validator: (value) => value == null ? 'Required' : null,
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String?>(
              initialValue: _branchId,
              decoration: const InputDecoration(labelText: 'Branch (optional)'),
              items: <DropdownMenuItem<String?>>[
                const DropdownMenuItem(
                  value: null,
                  child: Text('Company-wide'),
                ),
                ..._branches.map(
                  (b) => DropdownMenuItem(value: b.id, child: Text(b.name)),
                ),
              ],
              onChanged: widget.existing == null
                  ? (value) => setState(() => _branchId = value)
                  : null,
            ),
            if (_kind == FinanceKind.expense) ...<Widget>[
              const SizedBox(height: AppSpacing.md),
              DropdownButtonFormField<String?>(
                initialValue: _supplierId,
                decoration: const InputDecoration(
                  labelText: 'Supplier (optional)',
                ),
                items: <DropdownMenuItem<String?>>[
                  const DropdownMenuItem(value: null, child: Text('None')),
                  ..._suppliers.map(
                    (s) => DropdownMenuItem(value: s.id, child: Text(s.name)),
                  ),
                ],
                onChanged: (value) => setState(() => _supplierId = value),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            ListTile(
              shape: RoundedRectangleBorder(
                side: BorderSide(color: Theme.of(context).dividerColor),
                borderRadius: BorderRadius.circular(12),
              ),
              leading: const Icon(Icons.event_outlined),
              title: const Text('Transaction date'),
              subtitle: Text(financeDate(_date)),
              onTap: _pickDate,
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _notes,
              maxLength: 1000,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Notes (optional)'),
            ),
            const SizedBox(height: AppSpacing.lg),
            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: const Text('Save transaction'),
            ),
          ],
        ),
      ),
    );
  }
}
