import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/local_storage/local_storage.dart';
import 'package:machinery/core/local_storage/local_storage_constant_keys.dart';
import 'package:machinery/core/network_services/api_service.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/network_services/models/pagination_meta_model.dart';
import 'package:machinery/core/network_services/web_constant.dart';
import 'package:machinery/core/resources/debug_print.dart';
import 'package:machinery/feature/reports/data/models/report_models.dart';
import 'package:machinery/feature/reports/domain/entities/report_entities.dart';
import 'package:machinery/feature/reports/domain/repos/reports_repo.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

class ReportsRepoImpl implements ReportsRepo {
  ReportsRepoImpl({required this.apiService, required this.networkInfo});
  final ApiService apiService;
  final NetworkInfo networkInfo;
  final ValueNotifier<List<ReportJob>> _exports =
      ValueNotifier<List<ReportJob>>(const <ReportJob>[]);
  @override
  ValueListenable<List<ReportJob>> get exports => _exports;
  String get _ownerId =>
      LocalStorage.getCachedAuthUser()?['id']?.toString() ?? '';

  @override
  Future<Either<ServerFailure, List<ReportDefinition>>> catalogue() =>
      _guard('catalogue', () async {
        final response = await apiService.client().get<dynamic>(
          WebConstant.reports,
        );
        return allowedReports(
          _list(_rawData(response.data)).map(reportDefinitionFromJson),
        );
      });

  @override
  Future<Either<ServerFailure, ReportPage>> run(
    ReportDefinition report,
    ReportFilters filters, {
    int page = 1,
  }) => _guard('run', () async {
    final response = await apiService.client().get<dynamic>(
      _path(report, filters),
      queryParameters: filters.toQuery(page: page),
    );
    final Map<String, dynamic> body = _map(response.data);
    final result = reportResultFromJson(_map(_rawData(response.data)));
    final PaginationMetaModel meta = PaginationMetaModel.fromJson(
      _map(body['meta']),
    );
    return ReportPage(result: result, hasNext: meta.hasNext);
  });

  @override
  Future<Either<ServerFailure, ReportJob>> startExport(
    ReportDefinition report,
    ReportFilters filters,
    ReportFormat format,
  ) => _guard('startExport', () async {
    final response = await apiService.client().get<dynamic>(
      _path(report, filters),
      queryParameters: filters.toQuery(format: format.name),
    );
    final job = reportJobFromAccepted(
      _map(_rawData(response.data)),
      reportKey: report.key,
      format: format,
      ownerId: _ownerId,
    );
    _upsert(job);
    await _persist();
    unawaited(_pollAndDownload(job));
    return job;
  });

  String _path(ReportDefinition report, ReportFilters filters) {
    String path = WebConstant.report(report.path);
    if (path.contains('{id}')) {
      path = path.replaceFirst('{id}', filters.machineId ?? '');
    }
    return path;
  }

  Future<void> _pollAndDownload(ReportJob initial) async {
    ReportJob current = initial;
    for (int attempt = 0; attempt < 90; attempt++) {
      if (attempt > 0) await Future<void>.delayed(const Duration(seconds: 2));
      try {
        final response = await apiService.client().get<dynamic>(
          WebConstant.reportJob(current.id),
        );
        current = reportJobFromJson(
          _map(_rawData(response.data)),
          ownerId: _ownerId,
        );
        _upsert(current);
        await _persist();
        if (current.status == ReportJobStatus.failed) return;
        if (current.status == ReportJobStatus.ready &&
            current.downloadUrl != null) {
          final String path = await _download(current);
          current = current.copyWith(localPath: path);
          _upsert(current);
          await _persist();
          return;
        }
      } catch (error, stackTrace) {
        printDebug(
          message: 'report job ${current.id}: $error',
          stackTrace: stackTrace,
        );
      }
    }
    _upsert(
      current.copyWith(
        status: ReportJobStatus.failed,
        errorCode: 'POLL_TIMEOUT',
      ),
    );
    await _persist();
  }

  Future<String> _download(ReportJob job) async {
    final Directory documents = await getApplicationDocumentsDirectory();
    final Directory folder = Directory(
      '${documents.path}/reports/${_safe(_ownerId)}',
    );
    await folder.create(recursive: true);
    final String filename = _safe(
      job.filename ?? '${job.reportKey}.${job.format.name}',
    );
    final String path = '${folder.path}/${job.id}-$filename';
    await Dio().download(job.downloadUrl!, path);
    return path;
  }

  @override
  ReportFilters savedFilters(String reportKey) {
    try {
      final Object? decoded = json.decode(
        LocalStorage.local?.getString(StorageKeys.reportFilters) ?? '{}',
      );
      if (decoded is Map<String, dynamic> &&
          decoded[reportKey] is Map<String, dynamic>) {
        return ReportFilters.fromJson(
          decoded[reportKey] as Map<String, dynamic>,
        );
      }
    } catch (_) {}
    return const ReportFilters();
  }

  @override
  Future<void> saveFilters(String reportKey, ReportFilters filters) async {
    Map<String, dynamic> all = <String, dynamic>{};
    try {
      final Object? decoded = json.decode(
        LocalStorage.local?.getString(StorageKeys.reportFilters) ?? '{}',
      );
      if (decoded is Map<String, dynamic>) all = decoded;
    } catch (_) {}
    all[reportKey] = filters.toJson();
    await LocalStorage.local?.setString(
      StorageKeys.reportFilters,
      json.encode(all),
    );
  }

  @override
  Future<void> loadDownloadedExports() async {
    final List<ReportJob> jobs = <ReportJob>[];
    for (final String raw
        in LocalStorage.local?.getStringList(StorageKeys.downloadedReports) ??
            const <String>[]) {
      try {
        final Object? decoded = json.decode(raw);
        if (decoded is Map<String, dynamic>) {
          final job = reportJobFromJson(decoded);
          if (job.ownerId == _ownerId) jobs.add(job);
        }
      } catch (_) {}
    }
    _exports.value = jobs;
    for (final job in jobs.where(
      (j) => !j.isDownloaded && j.status != ReportJobStatus.failed,
    )) {
      unawaited(_pollAndDownload(job));
    }
  }

  @override
  Future<void> openExport(ReportJob job) async {
    if (job.localPath != null && await File(job.localPath!).exists()) {
      await OpenFilex.open(job.localPath!);
    }
  }

  @override
  Future<void> shareExport(ReportJob job) async {
    if (job.localPath != null && await File(job.localPath!).exists()) {
      await SharePlus.instance.share(
        ShareParams(files: <XFile>[XFile(job.localPath!)]),
      );
    }
  }

  void _upsert(ReportJob job) {
    final List<ReportJob> values = _exports.value.toList();
    final int index = values.indexWhere((e) => e.id == job.id);
    if (index < 0) {
      values.insert(0, job);
    } else {
      values[index] = job;
    }
    _exports.value = List<ReportJob>.unmodifiable(values);
  }

  Future<void> _persist() => LocalStorage.local!.setStringList(
    StorageKeys.downloadedReports,
    _exports.value.map((e) => json.encode(e.toJson())).toList(growable: false),
  );

  Future<Either<ServerFailure, T>> _guard<T>(
    String label,
    Future<T> Function() run,
  ) async {
    try {
      if (!await networkInfo.isConnected) {
        return Left(OfflineFailure(LocaleKeys.reportsOffline.tr()));
      }
      return Right(await run());
    } on DioException catch (error, stackTrace) {
      printDebug(
        message: 'reports repo $label: ${error.message}',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure.fromDioException(error));
    } catch (error, stackTrace) {
      printDebug(
        message: 'reports repo $label: $error',
        stackTrace: stackTrace,
      );
      return Left(ServerFailure(LocaleKeys.anErrorOccurred.tr()));
    }
  }

  static Object? _rawData(Object? raw) => _map(raw)['data'];
  static Map<String, dynamic> _map(Object? raw) =>
      raw is Map<String, dynamic> ? raw : const <String, dynamic>{};
  static List<Map<String, dynamic>> _list(Object? raw) => raw is List
      ? raw.whereType<Map<String, dynamic>>().toList(growable: false)
      : const <Map<String, dynamic>>[];
  static String _safe(String value) =>
      value.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
}
