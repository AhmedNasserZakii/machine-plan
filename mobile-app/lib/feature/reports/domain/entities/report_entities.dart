import 'package:equatable/equatable.dart';

enum ReportCellType {
  text,
  number,
  date;

  static ReportCellType fromJson(Object? value) => switch (value) {
    'number' => number,
    'date' => date,
    _ => text,
  };
}

enum ReportFormat { csv, xlsx, pdf }

enum ReportJobStatus {
  queued,
  running,
  ready,
  failed;

  static ReportJobStatus fromJson(Object? value) => switch (value) {
    'RUNNING' => running,
    'READY' => ready,
    'FAILED' => failed,
    _ => queued,
  };
}

class ReportDefinition extends Equatable {
  const ReportDefinition({
    required this.key,
    required this.title,
    required this.permission,
    required this.path,
    required this.allowed,
  });
  final String key, title, permission, path;
  final bool allowed;
  String get section => switch (key) {
    final k when k.startsWith('machine-') || k == 'warranty-expiry' =>
      'machines',
    final k when k.startsWith('transfer') => 'transfers',
    'representative-performance' || 'violations-register' => 'people',
    'merchant-portfolio' => 'merchants',
    'maintenance-log' => 'maintenance',
    _ => 'finance',
  };
  @override
  List<Object?> get props => <Object?>[key, title, permission, path, allowed];
}

List<ReportDefinition> allowedReports(Iterable<ReportDefinition> reports) =>
    reports
        .where((ReportDefinition report) => report.allowed)
        .toList(growable: false);

class ReportColumn extends Equatable {
  const ReportColumn({
    required this.key,
    required this.header,
    required this.type,
  });
  final String key, header;
  final ReportCellType type;
  @override
  List<Object?> get props => <Object?>[key, header, type];
}

class ReportResult extends Equatable {
  const ReportResult({
    required this.key,
    required this.title,
    required this.generatedAt,
    required this.filters,
    required this.columns,
    required this.rows,
    required this.totals,
    required this.rowCount,
    required this.truncated,
    this.extra = const <String, dynamic>{},
  });
  final String key, title;
  final DateTime generatedAt;
  final Map<String, dynamic> filters, totals, extra;
  final List<ReportColumn> columns;
  final List<Map<String, dynamic>> rows;
  final int rowCount;
  final bool truncated;
  // Profit/loss is the backend's canonical time series. Older API versions
  // return the points in `rows` and only put granularity/by-branch data in
  // `extra`, so the renderer cannot rely on an `extra.series` marker alone.
  bool get hasSeries => extra['series'] is List || key == 'profit-loss';
  bool get hasGroups => extra['groups'] is List;
  @override
  List<Object?> get props => <Object?>[
    key,
    title,
    generatedAt,
    filters,
    columns,
    rows,
    totals,
    rowCount,
    truncated,
    extra,
  ];
}

class ReportFilters extends Equatable {
  const ReportFilters({
    this.dateFrom,
    this.dateTo,
    this.branchId,
    this.groupBy,
    this.days,
    this.granularity,
    this.machineId,
    this.sortBy,
    this.sortDir = 'desc',
  });
  final DateTime? dateFrom, dateTo;
  final String? branchId, groupBy, granularity, machineId, sortBy, sortDir;
  final int? days;
  Map<String, dynamic> toQuery({int page = 1, String format = 'json'}) =>
      <String, dynamic>{
        'page': page,
        'limit': 20,
        'format': format,
        'sortDir': sortDir,
        if (dateFrom != null) 'dateFrom': _date(dateFrom!),
        if (dateTo != null) 'dateTo': _date(dateTo!),
        if (branchId != null) 'branchId': branchId,
        if (groupBy != null) 'groupBy': groupBy,
        if (days != null) 'days': days,
        if (granularity != null) 'granularity': granularity,
        if (sortBy != null) 'sortBy': sortBy,
      };
  ReportFilters copyWith({
    DateTime? dateFrom,
    DateTime? dateTo,
    String? branchId,
    String? groupBy,
    int? days,
    String? granularity,
    String? machineId,
    String? sortBy,
    String? sortDir,
    bool clearBranch = false,
  }) => ReportFilters(
    dateFrom: dateFrom ?? this.dateFrom,
    dateTo: dateTo ?? this.dateTo,
    branchId: clearBranch ? null : branchId ?? this.branchId,
    groupBy: groupBy ?? this.groupBy,
    days: days ?? this.days,
    granularity: granularity ?? this.granularity,
    machineId: machineId ?? this.machineId,
    sortBy: sortBy ?? this.sortBy,
    sortDir: sortDir ?? this.sortDir,
  );
  Map<String, dynamic> toJson() => <String, dynamic>{
    ...toQuery()
      ..remove('page')
      ..remove('limit')
      ..remove('format'),
    if (machineId != null) 'machineId': machineId,
  };
  factory ReportFilters.fromJson(Map<String, dynamic> json) => ReportFilters(
    dateFrom: DateTime.tryParse(json['dateFrom']?.toString() ?? ''),
    dateTo: DateTime.tryParse(json['dateTo']?.toString() ?? ''),
    branchId: json['branchId'] as String?,
    groupBy: json['groupBy'] as String?,
    days: json['days'] as int?,
    granularity: json['granularity'] as String?,
    machineId: json['machineId'] as String?,
    sortBy: json['sortBy'] as String?,
    sortDir: json['sortDir'] as String? ?? 'desc',
  );
  @override
  List<Object?> get props => <Object?>[
    dateFrom,
    dateTo,
    branchId,
    groupBy,
    days,
    granularity,
    machineId,
    sortBy,
    sortDir,
  ];
}

class ReportJob extends Equatable {
  const ReportJob({
    required this.id,
    required this.reportKey,
    required this.format,
    required this.status,
    required this.expiresAt,
    this.filename,
    this.downloadUrl,
    this.errorCode,
    this.localPath,
    this.rowCount,
    this.sizeBytes,
    this.ownerId = '',
  });
  final String id, reportKey, ownerId;
  final ReportFormat format;
  final ReportJobStatus status;
  final DateTime expiresAt;
  final String? filename, downloadUrl, errorCode, localPath;
  final int? rowCount, sizeBytes;
  bool get isDownloaded => localPath != null;
  ReportJob copyWith({
    ReportJobStatus? status,
    String? filename,
    String? downloadUrl,
    String? errorCode,
    String? localPath,
    int? rowCount,
    int? sizeBytes,
  }) => ReportJob(
    id: id,
    reportKey: reportKey,
    format: format,
    status: status ?? this.status,
    expiresAt: expiresAt,
    filename: filename ?? this.filename,
    downloadUrl: downloadUrl ?? this.downloadUrl,
    errorCode: errorCode ?? this.errorCode,
    localPath: localPath ?? this.localPath,
    rowCount: rowCount ?? this.rowCount,
    sizeBytes: sizeBytes ?? this.sizeBytes,
    ownerId: ownerId,
  );
  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'reportKey': reportKey,
    'format': format.name,
    'status': status.name.toUpperCase(),
    'expiresAt': expiresAt.toIso8601String(),
    'filename': filename,
    'localPath': localPath,
    'rowCount': rowCount,
    'sizeBytes': sizeBytes,
    'ownerId': ownerId,
  };
  @override
  List<Object?> get props => <Object?>[
    id,
    reportKey,
    format,
    status,
    expiresAt,
    filename,
    downloadUrl,
    errorCode,
    localPath,
    rowCount,
    sizeBytes,
    ownerId,
  ];
}

String _date(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
