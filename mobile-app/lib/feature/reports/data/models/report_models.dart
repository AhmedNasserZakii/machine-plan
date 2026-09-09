import 'package:machinery/feature/reports/domain/entities/report_entities.dart';

Map<String, dynamic> _map(Object? value) =>
    value is Map<String, dynamic> ? value : const <String, dynamic>{};
List<Map<String, dynamic>> _maps(Object? value) => value is List
    ? value.whereType<Map<String, dynamic>>().toList(growable: false)
    : const <Map<String, dynamic>>[];
int? _intOrNull(Object? value) => value is num ? value.toInt() : null;

ReportDefinition reportDefinitionFromJson(Map<String, dynamic> json) =>
    ReportDefinition(
      key: json['key']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      permission: json['permission']?.toString() ?? '',
      path: json['path']?.toString() ?? '',
      allowed: json['allowed'] as bool? ?? false,
    );

ReportColumn reportColumnFromJson(Map<String, dynamic> json) => ReportColumn(
  key: json['key']?.toString() ?? '',
  header: json['header']?.toString() ?? '',
  type: ReportCellType.fromJson(json['type']),
);

ReportResult reportResultFromJson(Map<String, dynamic> json) => ReportResult(
  key: json['key']?.toString() ?? '',
  title: json['title']?.toString() ?? '',
  generatedAt:
      DateTime.tryParse(json['generatedAt']?.toString() ?? '') ??
      DateTime(1970),
  filters: _map(json['filters']),
  columns: _maps(
    json['columns'],
  ).map(reportColumnFromJson).toList(growable: false),
  rows: _maps(json['rows']),
  totals: _map(json['totals']),
  rowCount: _intOrNull(json['rowCount']) ?? 0,
  truncated: json['truncated'] as bool? ?? false,
  extra: _map(json['extra']),
);

ReportJob reportJobFromAccepted(
  Map<String, dynamic> json, {
  required String reportKey,
  required ReportFormat format,
  required String ownerId,
}) => ReportJob(
  id: json['jobId']?.toString() ?? '',
  reportKey: reportKey,
  format: format,
  status: ReportJobStatus.fromJson(json['status']),
  expiresAt: DateTime.now().add(const Duration(hours: 24)),
  ownerId: ownerId,
);

ReportJob reportJobFromJson(Map<String, dynamic> json, {String ownerId = ''}) =>
    ReportJob(
      id: json['id']?.toString() ?? '',
      reportKey: json['reportKey']?.toString() ?? '',
      format: ReportFormat.values.firstWhere(
        (v) => v.name == json['format'],
        orElse: () => ReportFormat.csv,
      ),
      status: ReportJobStatus.fromJson(json['status']),
      expiresAt:
          DateTime.tryParse(json['expiresAt']?.toString() ?? '') ??
          DateTime.now(),
      filename: json['filename'] as String?,
      downloadUrl: json['downloadUrl'] as String?,
      errorCode: json['errorCode'] as String?,
      rowCount: _intOrNull(json['rowCount']),
      sizeBytes: _intOrNull(json['sizeBytes']),
      localPath: json['localPath'] as String?,
      ownerId: json['ownerId']?.toString() ?? ownerId,
    );
