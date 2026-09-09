import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/feature/reports/data/models/report_models.dart';
import 'package:machinery/feature/reports/domain/entities/report_entities.dart';

void main() {
  group('reports contract', () {
    test('catalogue keeps only backend-allowed entries', () {
      final allowed = reportDefinitionFromJson(<String, dynamic>{'key': 'profit-loss', 'title': 'Profit and loss', 'permission': P.reportsFinance, 'path': '/reports/finance/pnl', 'allowed': true});
      final denied = reportDefinitionFromJson(<String, dynamic>{'key': 'machine-inventory', 'title': 'Inventory', 'permission': P.reportsMachines, 'path': '/reports/machines/inventory', 'allowed': false});
      expect(allowedReports(<ReportDefinition>[allowed, denied]), <ReportDefinition>[allowed]);
      expect(allowed.section, 'finance');
    });

    test('parses self-describing rows, totals, and chart data', () {
      final result = reportResultFromJson(<String, dynamic>{
        'key': 'profit-loss', 'title': 'Profit and loss', 'generatedAt': '2026-09-08T12:00:00Z',
        'filters': <String, dynamic>{'granularity': 'MONTH'},
        'columns': <Map<String, dynamic>>[<String, dynamic>{'key': 'period', 'header': 'Period', 'type': 'date'}, <String, dynamic>{'key': 'net', 'header': 'Net', 'type': 'number'}],
        'rows': <Map<String, dynamic>>[<String, dynamic>{'period': '2026-09-01', 'net': 2000}],
        'totals': <String, dynamic>{'net': 2000}, 'rowCount': 1, 'truncated': false,
      });
      expect(result.columns.last.type, ReportCellType.number);
      expect(result.rows.single['net'], 2000);
      expect(result.totals['net'], 2000);
    });

    test('serializes report-specific filters', () {
      final filters = ReportFilters(dateFrom: DateTime(2026, 9, 1), dateTo: DateTime(2026, 9, 30), groupBy: 'branch', days: 30, granularity: 'MONTH', machineId: 'machine-id');
      expect(filters.toQuery(), containsPair('groupBy', 'branch'));
      expect(filters.toQuery(), containsPair('days', 30));
      expect(filters.toJson(), containsPair('machineId', 'machine-id'));
    });

    test('all hub permissions include merchant and maintenance reports', () {
      expect(P.anyReport, containsAll(<String>[P.reportsMachines, P.reportsTransfers, P.reportsViolations, P.reportsFinance, P.merchantsRead, P.maintenanceRead]));
    });

    test('every reports UI translation exists in Arabic and English', () {
      final en = json.decode(File('assets/translations/en.json').readAsStringSync()) as Map<String, dynamic>;
      final ar = json.decode(File('assets/translations/ar.json').readAsStringSync()) as Map<String, dynamic>;
      const keys = <String>['reports_title','reports_offline','reports_downloaded','reports_machines_section','reports_transfers_section','reports_people_section','reports_merchants_section','reports_maintenance_section','reports_finance_section','report_filters','report_export','report_table_view','report_card_view','report_grouped_view','report_chart_view','report_export_ready','report_export_failed'];
      for (final key in keys) { expect(en[key]?.toString().trim(), isNotEmpty, reason: 'missing English $key'); expect(ar[key]?.toString().trim(), isNotEmpty, reason: 'missing Arabic $key'); }
    });
  });
}
