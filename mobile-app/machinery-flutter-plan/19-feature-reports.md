# 19 — Feature: Reports

## Goal

Everything in the system is extractable: machines, custody, representatives, merchants, transfers,
violations, maintenance, expenses, income, budgets. One generic screen renders them all, because
the backend gives every report the same contract (`17` in the backend plan).

## Screens

| Page | Route | Permission |
|---|---|---|
| `ReportsHubPage` | `/reports` | any report permission |
| `ReportViewerPage` | `/reports/:key` | that report's permission |
| `ReportFiltersPage` | `/reports/:key/filters` | same |
| `ReportExportsPage` | `/reports/exports` | `reports.export` |

## Structure

```
features/reports/
├── data/
│   ├── models/ (report_definition.dart, report_filter.dart, report_result_model.dart,
│   │            report_column.dart, export_job_model.dart)
│   ├── datasources/reports_remote_datasource.dart
│   └── repositories/reports_repository.dart
└── presentation/
    ├── cubit/ (reports_hub_cubit.dart, report_viewer_cubit.dart, export_jobs_cubit.dart) + states
    ├── pages/
    └── widgets/
        ├── report_category_section.dart
        ├── report_tile.dart
        ├── report_filters_bar.dart
        ├── report_active_filters_chips.dart
        ├── report_date_range_field.dart
        ├── report_branch_filter.dart
        ├── report_group_by_selector.dart
        ├── report_summary_header.dart
        ├── report_kpi_row.dart
        ├── report_kpi_tile.dart
        ├── report_table_view.dart
        ├── report_table_header.dart
        ├── report_table_row.dart
        ├── report_grouped_list_view.dart
        ├── report_group_header.dart
        ├── report_chart_view.dart
        ├── report_empty_state.dart
        ├── export_format_sheet.dart
        ├── export_job_tile.dart
        └── export_progress_indicator.dart
```

## ReportsHubPage

Reports grouped into sections, each tile permission-gated:

**الماكينات** — جرد الماكينات · العُهد (مين معاه إيه) · ماكينات ساكنة · تكاليف الماكينات · الضمانات القرّبت تخلص
**التسليمات** — سجل التسليمات · تسليمات معلقة
**الأفراد** — أداء المناديب · سجل المخالفات
**التجار** — محفظة التجار · الاشتراكات المستحقة
**الصيانة** — سجل الصيانة والتكاليف
**المالية** — المصاريف حسب القسم · الإيرادات حسب القسم · الأرباح والخسائر · أداء الميزانيات · مقارنة الفروع

## ReportViewerPage

Generic renderer driven by the report's declared shape:

| Shape | Rendered by |
|---|---|
| flat rows | `ReportTableView` — horizontally scrollable, sticky first column |
| grouped | `ReportGroupedListView` with collapsible `ReportGroupHeader`s |
| series | `ReportChartView` |
| KPI + detail | `ReportKpiRow` above either of the above |

`ReportSummaryHeader` always shows the period, the filters applied and the generation time — so a
screenshot is self-describing.

`ReportFiltersBar` is persistent at the top with `ReportActiveFiltersChips`; tapping opens the full
filter sheet. Filters persist per report between visits.

### Tables on phones

Horizontal scrolling tables are painful on a 5-inch screen. Rules:
- pin the identifying column (serial, name)
- limit to 4–5 visible columns, with a column chooser
- offer a "card view" toggle for narrow screens that renders each row as a stacked card
- default to card view on screens under 400 dp wide

## Export

`ExportFormatSheet`: Excel / CSV / PDF.

The backend returns `202` with a job id. The app:
1. shows `ExportProgressIndicator` and lets the user leave the screen
2. polls the job (or receives a push when ready)
3. on completion, downloads and offers open/share via the platform sheet
4. lists past exports in `ReportExportsPage` with expiry times

Tell the user the file is ready even if they navigated away — a local notification is appropriate here.

**Arabic in exports:** verified server-side (backend `17`) — UTF-8 BOM on CSV, embedded fonts in
PDF, RTL sheet direction in xlsx. The app just opens the file. Test on a real Windows Excel early;
this is the classic thing that breaks after launch.

## Offline

Reports are **online-only**. Show a clear "التقارير محتاجة اتصال بالإنترنت" state. Previously
downloaded export files remain openable from `ReportExportsPage`.

## Rules

1. Never build report aggregation client-side. If a number is needed, the backend computes it.
2. Every report respects branch scope automatically — no client-side filtering of sensitive rows.
3. Large reports paginate; do not attempt to render 1,000 rows at once.
4. Money in reports uses `Formatters.currency`; dates use `Formatters.date`. No exceptions.
