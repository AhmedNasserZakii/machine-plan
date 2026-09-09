import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';
import 'package:machinery/feature/finance/presentation/pages/transaction_form_screen.dart';
import 'package:machinery/feature/finance/presentation/widgets/finance_widgets.dart';

class TransactionDetailScreen extends StatefulWidget {
  const TransactionDetailScreen({required this.transaction, super.key});
  final FinanceTransaction transaction;
  @override
  State<TransactionDetailScreen> createState() =>
      _TransactionDetailScreenState();
}

class _TransactionDetailScreenState extends State<TransactionDetailScreen> {
  late FinanceTransaction _row = widget.transaction;
  final FinanceRepo _repo = getIt<FinanceRepo>();
  Future<void> _edit() async {
    final updated = await Navigator.push<FinanceTransaction>(
      context,
      MaterialPageRoute(builder: (_) => TransactionFormScreen(existing: _row)),
    );
    if (updated != null) setState(() => _row = updated);
  }

  Future<void> _void() async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Void transaction'),
        content: TextField(
          controller: controller,
          maxLength: 500,
          decoration: const InputDecoration(
            labelText: 'Reason (at least 5 characters)',
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Void'),
          ),
        ],
      ),
    );
    if (reason == null || reason.length < 5) return;
    final result = await _repo.voidTransaction(_row.id, reason);
    if (!mounted) return;
    result.fold(
      (f) => showErrorToast(f.errorMessage, context),
      (row) => setState(() => _row = row),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(_row.referenceNo),
      actions: <Widget>[
        if (_row.isEditable && getIt<PermissionService>().has(P.financeUpdate))
          IconButton(onPressed: _edit, icon: const Icon(Icons.edit_outlined)),
        if (_row.isVoidable && getIt<PermissionService>().has(P.financeVoid))
          IconButton(onPressed: _void, icon: const Icon(Icons.block_outlined)),
      ],
    ),
    body: ListView(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      children: <Widget>[
        if (_row.isAutomatic)
          Container(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.infoSurfaceColor,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: const Row(
              children: <Widget>[
                Icon(Icons.lock_outline, color: AppColors.infoColor),
                SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'Auto-generated transaction. It is immutable and follows its source record.',
                  ),
                ),
              ],
            ),
          ),
        if (_row.isVoided)
          Container(
            margin: const EdgeInsetsDirectional.only(top: AppSpacing.sm),
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            color: AppColors.dangerSurfaceColor,
            child: Text('Voided: ${_row.voidReason ?? ''}'),
          ),
        const SizedBox(height: AppSpacing.md),
        Center(
          child: Text(
            formatMoney(context, _row.amount),
            style: Styles.s24(context).copyWith(
              color: _row.kind == FinanceKind.income
                  ? AppColors.successColor
                  : AppColors.dangerColor,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        ...<MapEntry<String, String>>[
          MapEntry('Kind', _row.kind.apiValue),
          MapEntry(
            'Category',
            _row.category.path.isEmpty
                ? _row.category.name
                : _row.category.path,
          ),
          MapEntry('Date', DateFormat.yMMMMd().format(_row.transactionDate)),
          MapEntry('Payment method', _row.paymentMethod.name),
          MapEntry('Scope', _row.branch?.name ?? 'Company'),
          if (_row.supplier != null) MapEntry('Supplier', _row.supplier!.name),
          MapEntry('Source', _row.source),
          if (_row.notes != null) MapEntry('Notes', _row.notes!),
        ].map(
          (entry) => Card(
            child: ListTile(
              title: Text(entry.key),
              subtitle: Text(entry.value),
            ),
          ),
        ),
      ],
    ),
  );
}
