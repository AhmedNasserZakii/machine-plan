import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/feature/reports/domain/entities/report_entities.dart';
import 'package:machinery/feature/reports/presentation/widgets/report_views.dart';

void main() {
  testWidgets('wide report pins identifier and remains usable on phone', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final columns = <ReportColumn>[
      const ReportColumn(
        key: 'serial',
        header: 'Serial',
        type: ReportCellType.text,
      ),
      ...List<ReportColumn>.generate(
        8,
        (i) => ReportColumn(
          key: 'c$i',
          header: 'Column $i',
          type: ReportCellType.number,
        ),
      ),
    ];
    final result = ReportResult(
      key: 'machine-inventory',
      title: 'Inventory',
      generatedAt: DateTime(2026),
      filters: const <String, dynamic>{},
      columns: columns,
      rows: <Map<String, dynamic>>[
        <String, dynamic>{
          'serial': 'SN-001',
          for (int i = 0; i < 8; i++) 'c$i': i,
        },
      ],
      totals: const <String, dynamic>{},
      rowCount: 1,
      truncated: false,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ReportTableView(
            result: result,
            visibleKeys: const <String>{'c0', 'c1', 'c2', 'c3'},
          ),
        ),
      ),
    );
    expect(find.text('SN-001'), findsOneWidget);
    expect(find.text('Serial'), findsOneWidget);
    expect(find.text('Column 4'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('card shape renders every field without horizontal overflow', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final result = ReportResult(
      key: 'transfers-log',
      title: 'Transfers',
      generatedAt: DateTime(2026),
      filters: const {},
      columns: const <ReportColumn>[
        ReportColumn(
          key: 'reference',
          header: 'Reference',
          type: ReportCellType.text,
        ),
        ReportColumn(
          key: 'count',
          header: 'Count',
          type: ReportCellType.number,
        ),
      ],
      rows: const <Map<String, dynamic>>[
        <String, dynamic>{'reference': 'TR-1', 'count': 10},
      ],
      totals: const {},
      rowCount: 1,
      truncated: false,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ReportCardView(result: result)),
      ),
    );
    expect(find.text('TR-1'), findsOneWidget);
    expect(find.text('10'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
