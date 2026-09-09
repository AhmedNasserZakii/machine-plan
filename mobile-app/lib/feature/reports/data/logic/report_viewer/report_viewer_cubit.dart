import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/feature/reports/domain/entities/report_entities.dart';
import 'package:machinery/feature/reports/domain/repos/reports_repo.dart';

enum ReportViewMode { table, cards, grouped, chart }

sealed class ReportViewerState extends Equatable {
  const ReportViewerState();
  @override
  List<Object?> get props => const <Object?>[];
}

class ReportViewerLoading extends ReportViewerState {
  const ReportViewerLoading();
}

class ReportViewerFailure extends ReportViewerState {
  const ReportViewerFailure(this.message);
  final String message;
  @override
  List<Object?> get props => <Object?>[message];
}

class ReportViewerLoaded extends ReportViewerState {
  const ReportViewerLoaded({
    required this.result,
    required this.filters,
    required this.page,
    required this.hasNext,
    required this.mode,
    this.loadingMore = false,
  });
  final ReportResult result;
  final ReportFilters filters;
  final int page;
  final bool hasNext, loadingMore;
  final ReportViewMode mode;
  ReportViewerLoaded copyWith({
    ReportResult? result,
    ReportFilters? filters,
    int? page,
    bool? hasNext,
    bool? loadingMore,
    ReportViewMode? mode,
  }) => ReportViewerLoaded(
    result: result ?? this.result,
    filters: filters ?? this.filters,
    page: page ?? this.page,
    hasNext: hasNext ?? this.hasNext,
    loadingMore: loadingMore ?? this.loadingMore,
    mode: mode ?? this.mode,
  );
  @override
  List<Object?> get props => <Object?>[
    result,
    filters,
    page,
    hasNext,
    loadingMore,
    mode,
  ];
}

class ReportViewerCubit extends Cubit<ReportViewerState> {
  ReportViewerCubit({required this.repo, required this.report})
    : super(const ReportViewerLoading());
  final ReportsRepo repo;
  final ReportDefinition report;
  Future<void> load({
    ReportFilters? filters,
    bool showLoader = true,
    double viewportWidth = 400,
  }) async {
    final selected = filters ?? repo.savedFilters(report.key);
    if (showLoader) emit(const ReportViewerLoading());
    await repo.saveFilters(report.key, selected);
    final response = await repo.run(report, selected);
    if (isClosed) return;
    response.fold((f) => emit(ReportViewerFailure(f.errorMessage)), (page) {
      final mode = page.result.hasGroups
          ? ReportViewMode.grouped
          : page.result.hasSeries
          ? ReportViewMode.chart
          : viewportWidth < 400
          ? ReportViewMode.cards
          : ReportViewMode.table;
      emit(
        ReportViewerLoaded(
          result: page.result,
          filters: selected,
          page: 1,
          hasNext: page.hasNext,
          mode: mode,
        ),
      );
    });
  }

  Future<void> loadMore() async {
    final current = state;
    if (current is! ReportViewerLoaded ||
        !current.hasNext ||
        current.loadingMore) {
      return;
    }
    emit(current.copyWith(loadingMore: true));
    final next = current.page + 1;
    final response = await repo.run(report, current.filters, page: next);
    if (isClosed) return;
    response.fold((_) => emit(current.copyWith(loadingMore: false)), (page) {
      final combined = ReportResult(
        key: current.result.key,
        title: current.result.title,
        generatedAt: current.result.generatedAt,
        filters: current.result.filters,
        columns: current.result.columns,
        rows: <Map<String, dynamic>>[
          ...current.result.rows,
          ...page.result.rows,
        ],
        totals: current.result.totals,
        rowCount: current.result.rowCount,
        truncated: current.result.truncated,
        extra: current.result.extra,
      );
      emit(
        current.copyWith(
          result: combined,
          page: next,
          hasNext: page.hasNext,
          loadingMore: false,
        ),
      );
    });
  }

  void setMode(ReportViewMode mode) {
    final current = state;
    if (current is ReportViewerLoaded) emit(current.copyWith(mode: mode));
  }
}
