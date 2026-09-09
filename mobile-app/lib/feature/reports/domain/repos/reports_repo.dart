import 'package:dartz/dartz.dart';
import 'package:flutter/foundation.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/reports/domain/entities/report_entities.dart';

class ReportPage {
  const ReportPage({required this.result, required this.hasNext});
  final ReportResult result;
  final bool hasNext;
}

abstract class ReportsRepo {
  ValueListenable<List<ReportJob>> get exports;
  Future<Either<ServerFailure, List<ReportDefinition>>> catalogue();
  Future<Either<ServerFailure, ReportPage>> run(
    ReportDefinition report,
    ReportFilters filters, {
    int page = 1,
  });
  Future<Either<ServerFailure, ReportJob>> startExport(
    ReportDefinition report,
    ReportFilters filters,
    ReportFormat format,
  );
  ReportFilters savedFilters(String reportKey);
  Future<void> saveFilters(String reportKey, ReportFilters filters);
  Future<void> loadDownloadedExports();
  Future<void> openExport(ReportJob job);
  Future<void> shareExport(ReportJob job);
}
