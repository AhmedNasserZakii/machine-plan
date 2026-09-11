import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/feature/reports/data/models/report_models.dart';
import 'package:machinery/feature/reports/domain/entities/report_entities.dart';

void main() {
  group('reports contract', () {
    test('catalogue keeps only backend-allowed entries', () {
      final allowed = reportDefinitionFromJson(<String, dynamic>{
        'key': 'profit-loss',
        'title': 'Profit and loss',
        'permission': P.reportsFinance,
        'path': '/reports/finance/pnl',
        'allowed': true,
      });
      final denied = reportDefinitionFromJson(<String, dynamic>{
        'key': 'machine-inventory',
        'title': 'Inventory',
        'permission': P.reportsMachines,
        'path': '/reports/machines/inventory',
        'allowed': false,
      });
      expect(
        allowedReports(<ReportDefinition>[allowed, denied]),
        <ReportDefinition>[allowed],
      );
      expect(allowed.section, 'finance');
    });

    test('parses self-describing rows, totals, and chart data', () {
      final result = reportResultFromJson(<String, dynamic>{
        'key': 'profit-loss',
        'title': 'Profit and loss',
        'generatedAt': '2026-09-08T12:00:00Z',
        'filters': <String, dynamic>{'granularity': 'MONTH'},
        'columns': <Map<String, dynamic>>[
          <String, dynamic>{
            'key': 'period',
            'header': 'Period',
            'type': 'date',
          },
          <String, dynamic>{'key': 'net', 'header': 'Net', 'type': 'number'},
        ],
        'rows': <Map<String, dynamic>>[
          <String, dynamic>{'period': '2026-09-01', 'net': 2000},
        ],
        'totals': <String, dynamic>{'net': 2000},
        'rowCount': 1,
        'truncated': false,
      });
      expect(result.columns.last.type, ReportCellType.number);
      expect(result.rows.single['net'], 2000);
      expect(result.totals['net'], 2000);
      expect(result.hasSeries, isTrue);
    });

    test('serializes report-specific filters', () {
      final filters = ReportFilters(
        dateFrom: DateTime(2026, 9, 1),
        dateTo: DateTime(2026, 9, 30),
        groupBy: 'branch',
        days: 30,
        granularity: 'MONTH',
        machineId: 'machine-id',
      );
      expect(filters.toQuery(), containsPair('groupBy', 'branch'));
      expect(filters.toQuery(), containsPair('days', 30));
      expect(filters.toJson(), containsPair('machineId', 'machine-id'));
    });

    test('parses accepted and ready export jobs without losing ownership', () {
      final accepted = reportJobFromAccepted(
        <String, dynamic>{'jobId': 'job-1', 'status': 'QUEUED'},
        reportKey: 'profit-loss',
        format: ReportFormat.xlsx,
        ownerId: 'user-1',
      );
      expect(accepted.status, ReportJobStatus.queued);
      expect(accepted.ownerId, 'user-1');

      final ready = reportJobFromJson(<String, dynamic>{
        'id': 'job-1',
        'reportKey': 'profit-loss',
        'format': 'xlsx',
        'status': 'READY',
        'expiresAt': '2026-09-12T12:00:00Z',
        'filename': 'profit-loss.xlsx',
        'downloadUrl': 'https://files.example/report',
        'rowCount': 42,
        'sizeBytes': 2048,
      }, ownerId: 'user-1');
      expect(ready.status, ReportJobStatus.ready);
      expect(ready.format, ReportFormat.xlsx);
      expect(ready.downloadUrl, isNotNull);
      expect(ready.rowCount, 42);
      expect(ready.ownerId, 'user-1');
    });

    test('all hub permissions include merchant and maintenance reports', () {
      expect(
        P.anyReport,
        containsAll(<String>[
          P.reportsMachines,
          P.reportsTransfers,
          P.reportsViolations,
          P.reportsFinance,
          P.merchantsRead,
          P.maintenanceRead,
        ]),
      );
    });

    test('every reports UI translation exists in Arabic and English', () {
      final en =
          json.decode(File('assets/translations/en.json').readAsStringSync())
              as Map<String, dynamic>;
      final ar =
          json.decode(File('assets/translations/ar.json').readAsStringSync())
              as Map<String, dynamic>;
      const keys = <String>[
        'reports_title',
        'reports_offline',
        'reports_downloaded',
        'reports_machines_section',
        'reports_transfers_section',
        'reports_people_section',
        'reports_merchants_section',
        'reports_maintenance_section',
        'reports_finance_section',
        'report_filters',
        'report_export',
        'report_table_view',
        'report_card_view',
        'report_grouped_view',
        'report_chart_view',
        'report_export_ready',
        'report_export_failed',
        'report_date_range',
        'report_backend_default_period',
        'report_branch',
        'report_all_branches',
        'report_group_by',
        'report_days_without_movement',
        'report_expires_within_days',
        'report_granularity',
        'report_machine_id',
        'report_machine_id_required',
        'report_clear_filters',
        'report_run',
        'report_export_format',
        'report_export_started',
        'report_visible_columns',
        'report_choose_columns',
        'report_apply',
        'report_load_more',
        'report_truncated',
        'report_rows_in_group',
        'report_no_chart_data',
        'report_no_rows',
        'report_group_representative',
        'report_group_supervisor',
        'report_group_branch',
        'report_group_merchant',
        'report_group_status',
        'report_group_model',
        'report_period_day',
        'report_period_week',
        'report_period_month',
        'report_period_year',
        'report_export_queued',
        'report_export_running',
      ];
      for (final key in keys) {
        expect(
          en[key]?.toString().trim(),
          isNotEmpty,
          reason: 'missing English $key',
        );
        expect(
          ar[key]?.toString().trim(),
          isNotEmpty,
          reason: 'missing Arabic $key',
        );
      }
    });
  });
}
