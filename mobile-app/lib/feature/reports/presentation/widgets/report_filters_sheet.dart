import 'package:flutter/material.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/finance/domain/entities/finance_entities.dart';
import 'package:machinery/feature/finance/domain/repos/finance_repo.dart';
import 'package:machinery/feature/reports/domain/entities/report_entities.dart';

class ReportFiltersSheet extends StatefulWidget {
  const ReportFiltersSheet({
    required this.report,
    required this.current,
    super.key,
  });
  final ReportDefinition report;
  final ReportFilters current;
  static Future<ReportFilters?> show(
    BuildContext context,
    ReportDefinition report,
    ReportFilters current,
  ) => showModalBottomSheet<ReportFilters>(
    context: context,
    isScrollControlled: true,
    builder: (_) => ReportFiltersSheet(report: report, current: current),
  );
  @override
  State<ReportFiltersSheet> createState() => _ReportFiltersSheetState();
}

class _ReportFiltersSheetState extends State<ReportFiltersSheet> {
  late DateTime? _from = widget.current.dateFrom;
  late DateTime? _to = widget.current.dateTo;
  late String? _branch = widget.current.branchId;
  late String? _group = widget.current.groupBy ?? 'representative';
  late String? _granularity = widget.current.granularity ?? 'MONTH';
  late final TextEditingController _days = TextEditingController(
    text: widget.current.days?.toString(),
  );
  late final TextEditingController _machine = TextEditingController(
    text: widget.current.machineId,
  );
  List<FinanceRef> _branches = const <FinanceRef>[];
  @override
  void initState() {
    super.initState();
    _loadBranches();
  }

  Future<void> _loadBranches() async {
    if (!getIt<PermissionService>().canSeeAllBranches(_scopeResource)) return;
    final result = await getIt<FinanceRepo>().branches();
    if (mounted) {
      result.fold((_) {}, (rows) => setState(() => _branches = rows));
    }
  }

  String get _scopeResource => widget.report.permission == 'reports.finance'
      ? 'finance'
      : widget.report.permission == 'reports.transfers'
      ? 'transfers'
      : widget.report.permission == 'reports.violations'
      ? 'violations'
      : widget.report.permission == 'merchants.read'
      ? 'merchants'
      : 'machines';
  Future<void> _dates() async {
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
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsetsDirectional.only(
        start: AppSpacing.md,
        end: AppSpacing.md,
        top: AppSpacing.md,
        bottom: MediaQuery.viewInsetsOf(context).bottom + AppSpacing.md,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              widget.report.title,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: AppSpacing.md),
            ListTile(
              shape: RoundedRectangleBorder(
                side: BorderSide(color: Theme.of(context).dividerColor),
                borderRadius: BorderRadius.circular(12),
              ),
              leading: const Icon(Icons.date_range),
              title: const Text('Date range'),
              subtitle: Text(
                _from == null
                    ? 'Backend default period'
                    : '${_date(_from!)} – ${_date(_to!)}',
              ),
              onTap: _dates,
            ),
            if (_branches.isNotEmpty) ...<Widget>[
              const SizedBox(height: AppSpacing.md),
              DropdownButtonFormField<String?>(
                initialValue: _branch,
                decoration: const InputDecoration(labelText: 'Branch'),
                items: <DropdownMenuItem<String?>>[
                  const DropdownMenuItem(
                    value: null,
                    child: Text('All branches'),
                  ),
                  ..._branches.map(
                    (b) => DropdownMenuItem(value: b.id, child: Text(b.name)),
                  ),
                ],
                onChanged: (v) => setState(() => _branch = v),
              ),
            ],
            if (widget.report.key == 'machine-custody') ...<Widget>[
              const SizedBox(height: AppSpacing.md),
              DropdownButtonFormField<String>(
                initialValue: _group,
                decoration: const InputDecoration(
                  labelText: 'Group custody by',
                ),
                items:
                    const <String>[
                          'representative',
                          'supervisor',
                          'branch',
                          'merchant',
                          'status',
                          'model',
                        ]
                        .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                        .toList(),
                onChanged: (v) => setState(() => _group = v),
              ),
            ],
            if (widget.report.key == 'machine-idle' ||
                widget.report.key == 'warranty-expiry') ...<Widget>[
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _days,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: widget.report.key == 'machine-idle'
                      ? 'Days without movement'
                      : 'Expires within days',
                ),
              ),
            ],
            if (widget.report.key == 'profit-loss') ...<Widget>[
              const SizedBox(height: AppSpacing.md),
              DropdownButtonFormField<String>(
                initialValue: _granularity,
                decoration: const InputDecoration(
                  labelText: 'Period granularity',
                ),
                items: const <String>['DAY', 'WEEK', 'MONTH', 'YEAR']
                    .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                    .toList(),
                onChanged: (v) => setState(() => _granularity = v),
              ),
            ],
            if (widget.report.key == 'machine-lifecycle') ...<Widget>[
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _machine,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  labelText: 'Machine ID',
                  helperText: 'Required for lifecycle report',
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton(
                    onPressed: () =>
                        Navigator.pop(context, const ReportFilters()),
                    child: const Text('Clear'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: FilledButton(
                    onPressed:
                        widget.report.key == 'machine-lifecycle' &&
                            _machine.text.trim().isEmpty
                        ? null
                        : () => Navigator.pop(
                            context,
                            ReportFilters(
                              dateFrom: _from,
                              dateTo: _to,
                              branchId: _branch,
                              groupBy: widget.report.key == 'machine-custody'
                                  ? _group
                                  : null,
                              days: int.tryParse(_days.text),
                              granularity: widget.report.key == 'profit-loss'
                                  ? _granularity
                                  : null,
                              machineId: _machine.text.trim().isEmpty
                                  ? null
                                  : _machine.text.trim(),
                              sortBy: widget.current.sortBy,
                              sortDir: widget.current.sortDir,
                            ),
                          ),
                    child: const Text('Run report'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

String _date(DateTime value) =>
    '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
