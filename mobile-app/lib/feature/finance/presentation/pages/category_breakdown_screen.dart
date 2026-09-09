import 'package:flutter/material.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/params/finance_params.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';
import 'package:machinery/feature/finance/presentation/widgets/finance_widgets.dart';

class CategoryBreakdownScreen extends StatefulWidget {
  const CategoryBreakdownScreen({required this.query, super.key});
  final FinanceQuery query;
  @override
  State<CategoryBreakdownScreen> createState() =>
      _CategoryBreakdownScreenState();
}

class _CategoryBreakdownScreenState extends State<CategoryBreakdownScreen> {
  final FinanceRepo _repo = getIt<FinanceRepo>();
  FinanceBreakdown? _data;
  String? _error;
  FinanceKind _kind = FinanceKind.expense;
  final List<CategoryBreakdown> _trail = <CategoryBreakdown>[];
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _data = null;
      _error = null;
    });
    final result = await _repo.breakdown(
      widget.query,
      _kind,
      rootCategoryId: _trail.isEmpty ? null : _trail.last.id,
    );
    if (!mounted) return;
    result.fold(
      (f) => setState(() => _error = f.errorMessage),
      (v) => setState(() => _data = v),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Category breakdown')),
    body: Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
          child: SegmentedButton<FinanceKind>(
            segments: const [
              ButtonSegment(value: FinanceKind.expense, label: Text('Expense')),
              ButtonSegment(value: FinanceKind.income, label: Text('Income')),
            ],
            selected: <FinanceKind>{_kind},
            onSelectionChanged: (v) {
              _kind = v.first;
              _trail.clear();
              _load();
            },
          ),
        ),
        if (_trail.isNotEmpty)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
            ),
            child: Row(
              children: <Widget>[
                ActionChip(
                  label: const Text('All'),
                  onPressed: () {
                    _trail.clear();
                    _load();
                  },
                ),
                ..._trail.map(
                  (c) => Row(
                    children: <Widget>[
                      const Icon(Icons.chevron_right, size: 18),
                      Text(c.name),
                    ],
                  ),
                ),
              ],
            ),
          ),
        Expanded(
          child: _error != null
              ? AppErrorView(message: _error!, onRetry: _load)
              : _data == null
              ? const AppLoadingIndicator()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                    children: <Widget>[
                      FinanceMetricCard(
                        label: 'Grand total',
                        value: formatMoney(context, _data!.grandTotal),
                        color: _kind == FinanceKind.expense
                            ? AppColors.dangerColor
                            : AppColors.successColor,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      ..._data!.categories.map(
                        (c) => Card(
                          child: ExpansionTile(
                            leading: CircleAvatar(
                              child: Text(
                                '${c.percentOfGrandTotal.toStringAsFixed(0)}%',
                              ),
                            ),
                            title: Text(c.name),
                            subtitle: Text(
                              'Direct ${formatMoney(context, c.directTotal)} • Rolled up ${formatMoney(context, c.rolledUpTotal)}',
                            ),
                            trailing: c.children.isEmpty
                                ? null
                                : IconButton(
                                    icon: const Icon(Icons.open_in_new),
                                    tooltip: 'Open subtree',
                                    onPressed: () {
                                      _trail.add(c);
                                      _load();
                                    },
                                  ),
                            children: <Widget>[
                              if (c.budget != null)
                                Padding(
                                  padding: const EdgeInsetsDirectional.all(
                                    AppSpacing.md,
                                  ),
                                  child: LinearProgressIndicator(
                                    value: (c.budget!.usedPercent / 100).clamp(
                                      0,
                                      1,
                                    ),
                                    color: budgetStatusColor(c.budget!.status),
                                    minHeight: 8,
                                  ),
                                ),
                              ...c.children.map(
                                (child) => ListTile(
                                  contentPadding: EdgeInsetsDirectional.only(
                                    start: AppSpacing.lg + child.depth * 8,
                                    end: AppSpacing.md,
                                  ),
                                  title: Text(child.name),
                                  subtitle: Text(
                                    'Direct ${formatMoney(context, child.directTotal)}',
                                  ),
                                  trailing: Text(
                                    formatMoney(context, child.rolledUpTotal),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
        ),
      ],
    ),
  );
}
