import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/reports/domain/entities/report_entities.dart';

String reportCellText(
  BuildContext context,
  Object? value,
  ReportCellType type,
) {
  if (value == null) return '—';
  if (type == ReportCellType.number && value is num) {
    return NumberFormat.decimalPattern(
      Localizations.localeOf(context).languageCode,
    ).format(value);
  }
  if (type == ReportCellType.date) {
    final parsed = DateTime.tryParse(value.toString());
    if (parsed != null) {
      return DateFormat.yMMMd(
        Localizations.localeOf(context).languageCode,
      ).format(parsed);
    }
  }
  if (value is Map) {
    return value['name']?.toString() ?? value.values.join(' · ');
  }
  return value.toString();
}

class ReportKpiRow extends StatelessWidget {
  const ReportKpiRow({required this.totals, super.key});
  final Map<String, dynamic> totals;
  @override
  Widget build(BuildContext context) => SizedBox(
    height: 96,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsetsDirectional.symmetric(horizontal: AppSpacing.md),
      itemCount: totals.length,
      separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
      itemBuilder: (_, index) {
        final entry = totals.entries.elementAt(index);
        return Container(
          width: 145,
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.infoSurfaceColor,
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Text(
                _human(entry.key),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Styles.s12(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
              ),
              Text(
                reportCellText(
                  context,
                  entry.value,
                  entry.value is num
                      ? ReportCellType.number
                      : ReportCellType.text,
                ),
                maxLines: 1,
                style: Styles.s17(context),
              ),
            ],
          ),
        );
      },
    ),
  );
}

class ReportCardView extends StatelessWidget {
  const ReportCardView({required this.result, super.key});
  final ReportResult result;
  @override
  Widget build(BuildContext context) => ListView.separated(
    padding: const EdgeInsetsDirectional.all(AppSpacing.md),
    itemCount: result.rows.length,
    separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
    itemBuilder: (_, index) {
      final row = result.rows[index];
      return Card(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          child: Column(
            children: result.columns
                .map(
                  (column) => Padding(
                    padding: const EdgeInsetsDirectional.symmetric(
                      vertical: AppSpacing.xs,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Expanded(
                          flex: 2,
                          child: Text(
                            column.header,
                            style: Styles.s12(
                              context,
                            ).copyWith(color: AppColors.textSecondaryColor),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          flex: 3,
                          child: Directionality(
                            textDirection: column.type == ReportCellType.number
                                ? TextDirection.ltr
                                : Directionality.of(context),
                            child: Text(
                              reportCellText(
                                context,
                                row[column.key],
                                column.type,
                              ),
                              textAlign: TextAlign.end,
                              style: Styles.s14(context),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
                .toList(growable: false),
          ),
        ),
      );
    },
  );
}

/// The identifying column stays pinned while the remaining cells scroll.
class ReportTableView extends StatelessWidget {
  const ReportTableView({
    required this.result,
    super.key,
    this.visibleKeys = const <String>{},
  });
  final ReportResult result;
  final Set<String> visibleKeys;
  @override
  Widget build(BuildContext context) {
    if (result.columns.isEmpty) return const SizedBox.shrink();
    final first = result.columns.first;
    final rest = result.columns
        .skip(1)
        .where((c) => visibleKeys.isEmpty || visibleKeys.contains(c.key))
        .toList();
    return Column(
      children: <Widget>[
        Container(
          color: AppColors.surfaceAltColor,
          child: Row(
            children: <Widget>[
              _cell(first.header, 145, true),
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: rest
                        .map((c) => _cell(c.header, 130, true))
                        .toList(),
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.separated(
            itemCount: result.rows.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (_, index) {
              final row = result.rows[index];
              return Row(
                children: <Widget>[
                  _cell(
                    reportCellText(context, row[first.key], first.type),
                    145,
                    true,
                  ),
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: rest
                            .map(
                              (c) => _cell(
                                reportCellText(context, row[c.key], c.type),
                                130,
                                false,
                              ),
                            )
                            .toList(),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _cell(String text, double width, bool strong) => SizedBox(
    width: width,
    height: 52,
    child: Padding(
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      child: Align(
        alignment: AlignmentDirectional.centerStart,
        child: Text(
          text,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontWeight: strong ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    ),
  );
}

class ReportGroupedView extends StatelessWidget {
  const ReportGroupedView({required this.result, super.key});
  final ReportResult result;
  @override
  Widget build(BuildContext context) {
    if (result.columns.isEmpty) return const SizedBox.shrink();
    final key = result.columns.first.key;
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final row in result.rows) {
      (groups[row[key]?.toString() ?? '—'] ??= <Map<String, dynamic>>[]).add(
        row,
      );
    }
    final detailColumn = result.columns.length > 1
        ? result.columns[1]
        : result.columns.first;
    return ListView(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      children: groups.entries
          .map(
            (entry) => Card(
              child: ExpansionTile(
                title: Text(entry.key),
                subtitle: Text('${entry.value.length} rows'),
                children: entry.value
                    .map(
                      (row) => ListTile(
                        title: Text(
                          reportCellText(
                            context,
                            row[detailColumn.key],
                            detailColumn.type,
                          ),
                        ),
                        subtitle: Text(
                          result.columns
                              .skip(2)
                              .take(3)
                              .map(
                                (c) =>
                                    '${c.header}: ${reportCellText(context, row[c.key], c.type)}',
                              )
                              .join(' · '),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          )
          .toList(),
    );
  }
}

class ReportChartView extends StatelessWidget {
  const ReportChartView({required this.result, super.key});
  final ReportResult result;
  @override
  Widget build(BuildContext context) {
    final numeric = result.columns
        .where((c) => c.type == ReportCellType.number)
        .take(3)
        .toList();
    if (numeric.isEmpty || result.rows.isEmpty) {
      return const Center(
        child: Text('This report has no numeric series to chart.'),
      );
    }
    final values = result.rows
        .take(20)
        .map(
          (row) => numeric
              .map(
                (c) => row[c.key] is num ? (row[c.key] as num).toDouble() : 0.0,
              )
              .toList(),
        )
        .toList();
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Wrap(
            spacing: AppSpacing.md,
            children: numeric
                .asMap()
                .entries
                .map(
                  (e) => Row(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Container(width: 12, height: 12, color: _colors[e.key]),
                      const SizedBox(width: 4),
                      Text(e.value.header),
                    ],
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: AppSpacing.md),
          CustomPaint(
            size: Size(math.max(340, values.length * 54), 300),
            painter: _Bars(values),
          ),
        ],
      ),
    );
  }
}

const _colors = <Color>[
  AppColors.primaryColor,
  AppColors.successColor,
  AppColors.dangerColor,
];

class _Bars extends CustomPainter {
  _Bars(this.values);
  final List<List<double>> values;
  @override
  void paint(Canvas canvas, Size size) {
    final maxValue = values.expand((e) => e).fold<double>(0, math.max);
    if (maxValue <= 0) return;
    final group = size.width / values.length;
    for (int i = 0; i < values.length; i++) {
      final barWidth = math.min(13.0, group / values[i].length - 2);
      for (int j = 0; j < values[i].length; j++) {
        final height = values[i][j] / maxValue * (size.height - 20);
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(
              i * group + j * (barWidth + 2),
              size.height - height,
              barWidth,
              height,
            ),
            const Radius.circular(3),
          ),
          Paint()..color = _colors[j],
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _Bars oldDelegate) =>
      oldDelegate.values != values;
}

String _human(String value) => value
    .replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}')
    .replaceAll('_', ' ');
