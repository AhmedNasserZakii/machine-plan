import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/feature/finance/data/logic/transactions/finance_transactions_cubit.dart';
import 'package:machinery/feature/finance/data/logic/transactions/finance_transactions_state.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:machinery/feature/finance/presentation/pages/transaction_detail_screen.dart';
import 'package:machinery/feature/finance/presentation/pages/transaction_form_screen.dart';
import 'package:machinery/feature/finance/presentation/widgets/finance_widgets.dart';

class FinanceTransactionsScreen extends StatefulWidget {
  const FinanceTransactionsScreen({required this.initialQuery, super.key});
  final TransactionQuery initialQuery;
  @override
  State<FinanceTransactionsScreen> createState() =>
      _FinanceTransactionsScreenState();
}

class _FinanceTransactionsScreenState extends State<FinanceTransactionsScreen> {
  @override
  void initState() {
    super.initState();
    context.read<FinanceTransactionsCubit>().load(query: widget.initialQuery);
  }

  Future<void> _add() async {
    final row = await Navigator.push<FinanceTransaction>(
      context,
      MaterialPageRoute(builder: (_) => const TransactionFormScreen()),
    );
    if (row != null && mounted) {
      if (row.isPendingSync) {
        context.read<FinanceTransactionsCubit>().prepend(row);
      } else {
        context.read<FinanceTransactionsCubit>().load(showLoader: false);
      }
    }
  }

  Future<void> _detail(FinanceTransaction row) async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => TransactionDetailScreen(transaction: row),
      ),
    );
    if (mounted) {
      context.read<FinanceTransactionsCubit>().load(showLoader: false);
    }
  }

  Future<void> _filters(FinanceTransactionsLoaded state) async {
    final query = await showModalBottomSheet<TransactionQuery>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _TransactionFilters(query: state.query),
    );
    if (query != null && mounted) {
      context.read<FinanceTransactionsCubit>().load(
        query: query,
        showLoader: false,
      );
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(LocaleKeys.financeTransactions.tr()),
      actions: <Widget>[
        BlocBuilder<FinanceTransactionsCubit, FinanceTransactionsState>(
          builder: (_, state) => IconButton(
            onPressed: state is FinanceTransactionsLoaded
                ? () => _filters(state)
                : null,
            icon: const Icon(Icons.filter_list),
          ),
        ),
      ],
    ),
    floatingActionButton: getIt<PermissionService>().has(P.financeCreate)
        ? FloatingActionButton(onPressed: _add, child: const Icon(Icons.add))
        : null,
    body: BlocBuilder<FinanceTransactionsCubit, FinanceTransactionsState>(
      builder: (context, state) => switch (state) {
        FinanceTransactionsLoaded() => PaginatedListView<FinanceTransaction>(
          items: state.items,
          hasNext: state.hasNext,
          isLoadingMore: state.isLoadingMore,
          onRefresh: () =>
              context.read<FinanceTransactionsCubit>().load(showLoader: false),
          onLoadMore: context.read<FinanceTransactionsCubit>().loadMore,
          emptyState: AppEmptyState(
            icon: Icons.receipt_long_outlined,
            title: LocaleKeys.financeNoTransactions.tr(),
            subtitle: LocaleKeys.financeNoTransactionsSubtitle.tr(),
          ),
          itemBuilder: (_, row, _) => FinanceTransactionTile(
            transaction: row,
            onTap: () => _detail(row),
          ),
        ),
        FinanceTransactionsFailure(:final message) => AppErrorView(
          message: message,
          onRetry: () => context.read<FinanceTransactionsCubit>().load(
            query: widget.initialQuery,
          ),
        ),
        _ => const AppLoadingIndicator(),
      },
    ),
  );
}

class _TransactionFilters extends StatefulWidget {
  const _TransactionFilters({required this.query});
  final TransactionQuery query;
  @override
  State<_TransactionFilters> createState() => _TransactionFiltersState();
}

class _TransactionFiltersState extends State<_TransactionFilters> {
  late FinanceKind? _kind = widget.query.kind;
  late bool _voided = widget.query.includeVoided;
  late final TextEditingController _search = TextEditingController(
    text: widget.query.search,
  );
  late final TextEditingController _min = TextEditingController(
    text: widget.query.minAmount?.toString(),
  );
  late final TextEditingController _max = TextEditingController(
    text: widget.query.maxAmount?.toString(),
  );
  late DateTime? _from = widget.query.dateFrom;
  late DateTime? _to = widget.query.dateTo;
  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsetsDirectional.only(
        start: 16,
        end: 16,
        top: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              LocaleKeys.financeFilterTransactions.tr(),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _search,
              decoration: InputDecoration(
                labelText: LocaleKeys.financeReferenceOrNotes.tr(),
                prefixIcon: const Icon(Icons.search),
              ),
            ),
            const SizedBox(height: 12),
            SegmentedButton<FinanceKind?>(
              segments: <ButtonSegment<FinanceKind?>>[
                ButtonSegment(
                  value: null,
                  label: Text(LocaleKeys.userFilterAll.tr()),
                ),
                ButtonSegment(
                  value: FinanceKind.expense,
                  label: Text(LocaleKeys.financeExpense.tr()),
                ),
                ButtonSegment(
                  value: FinanceKind.income,
                  label: Text(LocaleKeys.financeIncome.tr()),
                ),
              ],
              selected: <FinanceKind?>{_kind},
              onSelectionChanged: (v) => setState(() => _kind = v.first),
            ),
            const SizedBox(height: 12),
            Row(
              children: <Widget>[
                Expanded(
                  child: TextField(
                    controller: _min,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: LocaleKeys.financeMinAmount.tr(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _max,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: LocaleKeys.financeMaxAmount.tr(),
                    ),
                  ),
                ),
              ],
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(LocaleKeys.financeIncludeVoided.tr()),
              value: _voided,
              onChanged: (v) => setState(() => _voided = v),
            ),
            OutlinedButton.icon(
              onPressed: () async {
                final range = await showDateRangePicker(
                  context: context,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now(),
                );
                if (range != null) {
                  setState(() {
                    _from = range.start;
                    _to = range.end;
                  });
                }
              },
              icon: const Icon(Icons.date_range),
              label: _from == null
                  ? Text(LocaleKeys.financeDateRange.tr())
                  : LtrText(
                      '${financeDate(_from!)} – ${financeDate(_to!)}',
                    ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(
                  context,
                  TransactionQuery(
                    kind: _kind,
                    search: _search.text,
                    minAmount: double.tryParse(_min.text),
                    maxAmount: double.tryParse(_max.text),
                    includeVoided: _voided,
                    dateFrom: _from,
                    dateTo: _to,
                    branchId: widget.query.branchId,
                  ),
                ),
                child: Text(LocaleKeys.financeApplyFilters.tr()),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
