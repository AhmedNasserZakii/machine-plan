import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/reports/data/logic/report_viewer/report_viewer_cubit.dart';
import 'package:machinery/feature/reports/domain/entities/report_entities.dart';
import 'package:machinery/feature/reports/domain/repos/reports_repo.dart';
import 'package:machinery/feature/reports/presentation/pages/report_exports_screen.dart';
import 'package:machinery/feature/reports/presentation/widgets/report_filters_sheet.dart';
import 'package:machinery/feature/reports/presentation/widgets/report_views.dart';

class ReportViewerScreen extends StatefulWidget {
  const ReportViewerScreen({required this.report, super.key});
  final ReportDefinition report;
  @override
  State<ReportViewerScreen> createState() => _ReportViewerScreenState();
}

class _ReportViewerScreenState extends State<ReportViewerScreen> {
  final ReportsRepo _repo = getIt<ReportsRepo>();
  final Set<String> _visibleColumns = <String>{};
  bool _started = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) {
      return;
    }
    _started = true;
    final ReportFilters saved = _repo.savedFilters(widget.report.key);
    if (widget.report.key == 'machine-lifecycle' && saved.machineId == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _initialLifecycle());
      return;
    }
    context.read<ReportViewerCubit>().load(
      filters: saved,
      viewportWidth: MediaQuery.sizeOf(context).width,
    );
  }

  Future<void> _initialLifecycle() async {
    final ReportFilters? filters = await ReportFiltersSheet.show(
      context,
      widget.report,
      _repo.savedFilters(widget.report.key),
    );
    if (!mounted) return;
    if (filters == null || filters.machineId == null) {
      Navigator.pop(context);
      return;
    }
    context.read<ReportViewerCubit>().load(
      filters: filters,
      viewportWidth: MediaQuery.sizeOf(context).width,
    );
  }

  Future<void> _filters(ReportViewerLoaded state) async {
    final filters = await ReportFiltersSheet.show(
      context,
      widget.report,
      state.filters,
    );
    if (filters != null && mounted) {
      context.read<ReportViewerCubit>().load(
        filters: filters,
        showLoader: false,
        viewportWidth: MediaQuery.sizeOf(context).width,
      );
    }
  }

  Future<void> _export(ReportViewerLoaded state) async {
    final format = await showModalBottomSheet<ReportFormat>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            ListTile(title: Text(LocaleKeys.reportExportFormat.tr())),
            ...ReportFormat.values.map(
              (format) => ListTile(
                leading: Icon(
                  format == ReportFormat.pdf
                      ? Icons.picture_as_pdf_outlined
                      : Icons.table_view_outlined,
                ),
                title: Text(format.name.toUpperCase()),
                onTap: () => Navigator.pop(context, format),
              ),
            ),
          ],
        ),
      ),
    );
    if (format == null) return;
    final result = await _repo.startExport(
      widget.report,
      state.filters,
      format,
    );
    if (!mounted) return;
    result.fold((f) => showErrorToast(f.errorMessage, context), (_) {
      showSuccessToast(LocaleKeys.reportExportStarted.tr(), context);
      Navigator.push<void>(
        context,
        MaterialPageRoute(builder: (_) => const ReportExportsScreen()),
      );
    });
  }

  Future<void> _columns(ReportViewerLoaded state) async {
    if (_visibleColumns.isEmpty) {
      _visibleColumns.addAll(
        state.result.columns.skip(1).take(4).map((c) => c.key),
      );
    }
    final selected = await showModalBottomSheet<Set<String>>(
      context: context,
      builder: (sheetContext) {
        final draft = Set<String>.of(_visibleColumns);
        return StatefulBuilder(
          builder: (context, update) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                ListTile(title: Text(LocaleKeys.reportVisibleColumns.tr())),
                ...state.result.columns
                    .skip(1)
                    .map(
                      (column) => CheckboxListTile(
                        title: Text(column.header),
                        value: draft.contains(column.key),
                        onChanged: (value) => update(() {
                          if (value == true && draft.length < 4) {
                            draft.add(column.key);
                          } else if (value == false) {
                            draft.remove(column.key);
                          }
                        }),
                      ),
                    ),
                FilledButton(
                  onPressed: () => Navigator.pop(context, draft),
                  child: Text(LocaleKeys.reportApply.tr()),
                ),
              ],
            ),
          ),
        );
      },
    );
    if (selected != null) {
      setState(() {
        _visibleColumns
          ..clear()
          ..addAll(selected);
      });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.report.title),
      actions: <Widget>[
        ValueListenableBuilder<List<ReportJob>>(
          valueListenable: _repo.exports,
          builder: (_, jobs, _) => IconButton(
            onPressed: () => Navigator.push<void>(
              context,
              MaterialPageRoute(builder: (_) => const ReportExportsScreen()),
            ),
            icon: Badge(
              isLabelVisible: jobs.any(
                (j) =>
                    j.status == ReportJobStatus.running ||
                    j.status == ReportJobStatus.queued,
              ),
              child: const Icon(Icons.download_outlined),
            ),
          ),
        ),
      ],
    ),
    body: BlocBuilder<ReportViewerCubit, ReportViewerState>(
      builder: (context, state) {
        if (state is ReportViewerFailure) {
          return AppErrorView(
            message: state.message,
            onRetry: () => context.read<ReportViewerCubit>().load(
              viewportWidth: MediaQuery.sizeOf(context).width,
            ),
          );
        }
        if (state is! ReportViewerLoaded) return const AppLoadingIndicator();
        return Column(
          children: <Widget>[
            _ReportHeader(state: state, onFilters: () => _filters(state)),
            if (state.result.totals.isNotEmpty)
              ReportKpiRow(totals: state.result.totals),
            Padding(
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: SegmentedButton<ReportViewMode>(
                      showSelectedIcon: false,
                      segments: <ButtonSegment<ReportViewMode>>[
                        ButtonSegment(
                          value: ReportViewMode.table,
                          icon: const Icon(Icons.table_rows),
                          tooltip: LocaleKeys.reportTableView.tr(),
                        ),
                        ButtonSegment(
                          value: ReportViewMode.cards,
                          icon: const Icon(Icons.view_agenda_outlined),
                          tooltip: LocaleKeys.reportCardView.tr(),
                        ),
                        ButtonSegment(
                          value: ReportViewMode.grouped,
                          icon: const Icon(Icons.account_tree_outlined),
                          tooltip: LocaleKeys.reportGroupedView.tr(),
                        ),
                        ButtonSegment(
                          value: ReportViewMode.chart,
                          icon: const Icon(Icons.bar_chart),
                          tooltip: LocaleKeys.reportChartView.tr(),
                        ),
                      ],
                      selected: <ReportViewMode>{state.mode},
                      onSelectionChanged: (value) => context
                          .read<ReportViewerCubit>()
                          .setMode(value.first),
                    ),
                  ),
                  if (state.mode == ReportViewMode.table)
                    IconButton(
                      tooltip: LocaleKeys.reportChooseColumns.tr(),
                      onPressed: () => _columns(state),
                      icon: const Icon(Icons.view_column_outlined),
                    ),
                  if (getIt<PermissionService>().has(P.reportsExport))
                    IconButton(
                      tooltip: LocaleKeys.reportExport.tr(),
                      onPressed: () => _export(state),
                      icon: const Icon(Icons.ios_share_outlined),
                    ),
                ],
              ),
            ),
            Expanded(
              child: state.result.rows.isEmpty
                  ? Center(child: Text(LocaleKeys.reportNoRows.tr()))
                  : switch (state.mode) {
                      ReportViewMode.table => ReportTableView(
                        result: state.result,
                        visibleKeys: _visibleColumns,
                      ),
                      ReportViewMode.cards => ReportCardView(
                        result: state.result,
                      ),
                      ReportViewMode.grouped => ReportGroupedView(
                        result: state.result,
                      ),
                      ReportViewMode.chart => ReportChartView(
                        result: state.result,
                      ),
                    },
            ),
            if (state.hasNext)
              SafeArea(
                top: false,
                child: TextButton.icon(
                  onPressed: state.loadingMore
                      ? null
                      : context.read<ReportViewerCubit>().loadMore,
                  icon: state.loadingMore
                      ? const SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.expand_more),
                  label: Text(LocaleKeys.reportLoadMore.tr()),
                ),
              ),
          ],
        );
      },
    ),
  );
}

class _ReportHeader extends StatelessWidget {
  const _ReportHeader({required this.state, required this.onFilters});
  final ReportViewerLoaded state;
  final VoidCallback onFilters;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsetsDirectional.all(AppSpacing.md),
    color: AppColors.surfaceColor,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: Text(
                '${LocaleKeys.reportRows.tr(args: <String>[state.result.rowCount.toString()])} • ${LocaleKeys.reportGeneratedAt.tr(args: <String>[DateFormat.yMd().add_Hm().format(state.result.generatedAt.toLocal())])}',
                style: Styles.s12(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
              ),
            ),
            IconButton(
              onPressed: onFilters,
              icon: const Icon(Icons.tune),
              tooltip: LocaleKeys.reportFilters.tr(),
            ),
          ],
        ),
        if (state.result.truncated)
          Text(
            LocaleKeys.reportTruncated.tr(),
            style: Styles.s12(context).copyWith(color: AppColors.warningColor),
          ),
        Wrap(
          spacing: AppSpacing.xs,
          children: state.result.filters.entries
              .where((e) => e.value != null)
              .map(
                (e) => Chip(
                  label: Text(
                    '${e.key}: ${e.value}',
                    style: Styles.s10(context),
                  ),
                ),
              )
              .toList(),
        ),
      ],
    ),
  );
}
