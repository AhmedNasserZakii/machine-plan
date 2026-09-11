import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/reports/domain/entities/report_entities.dart';
import 'package:machinery/feature/reports/domain/repos/reports_repo.dart';

class ReportExportsScreen extends StatelessWidget {
  const ReportExportsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final repo = getIt<ReportsRepo>();
    return Scaffold(
      appBar: AppBar(title: Text(LocaleKeys.reportsDownloaded.tr())),
      body: ValueListenableBuilder<List<ReportJob>>(
        valueListenable: repo.exports,
        builder: (_, jobs, _) {
          if (jobs.isEmpty) {
            return Center(child: Text(LocaleKeys.reportNoDownloads.tr()));
          }
          return ListView.separated(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            itemCount: jobs.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
            itemBuilder: (_, index) {
              final job = jobs[index];
              final ready = job.isDownloaded;
              return Card(
                child: ListTile(
                  leading: job.status == ReportJobStatus.failed
                      ? const Icon(
                          Icons.error_outline,
                          color: AppColors.dangerColor,
                        )
                      : ready
                      ? const Icon(
                          Icons.description_outlined,
                          color: AppColors.successColor,
                        )
                      : const SizedBox.square(
                          dimension: 24,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                  title: Text(job.filename ?? job.reportKey),
                  subtitle: Text(
                    job.status == ReportJobStatus.failed
                        ? '${LocaleKeys.reportExportFailed.tr()}${job.errorCode == null ? '' : ': ${job.errorCode}'}'
                        : ready
                        ? '${job.format.name.toUpperCase()} • ${job.rowCount ?? 0} rows'
                        : (job.status == ReportJobStatus.running
                                  ? LocaleKeys.reportExportRunning
                                  : LocaleKeys.reportExportQueued)
                              .tr(),
                  ),
                  onTap: ready ? () => repo.openExport(job) : null,
                  trailing: ready
                      ? IconButton(
                          icon: const Icon(Icons.share_outlined),
                          onPressed: () => repo.shareExport(job),
                        )
                      : null,
                ),
              );
            },
          );
        },
      ),
    );
  }
}
