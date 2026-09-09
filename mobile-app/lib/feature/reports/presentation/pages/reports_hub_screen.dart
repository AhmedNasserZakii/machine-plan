import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/feature/reports/data/logic/report_viewer/report_viewer_cubit.dart';
import 'package:machinery/feature/reports/data/logic/reports_hub/reports_hub_cubit.dart';
import 'package:machinery/feature/reports/domain/entities/report_entities.dart';
import 'package:machinery/feature/reports/presentation/pages/report_exports_screen.dart';
import 'package:machinery/feature/reports/presentation/pages/report_viewer_screen.dart';

class ReportsHubScreen extends StatefulWidget {
  const ReportsHubScreen({super.key});
  @override
  State<ReportsHubScreen> createState() => _ReportsHubScreenState();
}

class _ReportsHubScreenState extends State<ReportsHubScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ReportsHubCubit>().load();
  }

  void _open(ReportDefinition report) {
    Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => BlocProvider<ReportViewerCubit>(
          create: (_) => getIt<ReportViewerCubit>(param1: report),
          child: ReportViewerScreen(report: report),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(LocaleKeys.reportsTitle.tr()),
      actions: <Widget>[
        IconButton(
          tooltip: LocaleKeys.reportsDownloaded.tr(),
          onPressed: () => Navigator.push<void>(
            context,
            MaterialPageRoute(builder: (_) => const ReportExportsScreen()),
          ),
          icon: const Icon(Icons.download_done_outlined),
        ),
      ],
    ),
    body: BlocBuilder<ReportsHubCubit, ReportsHubState>(
      builder: (context, state) {
        if (state is ReportsHubFailure) {
          return Column(
            children: <Widget>[
              Expanded(
                child: AppErrorView(
                  message: state.message,
                  onRetry: context.read<ReportsHubCubit>().load,
                ),
              ),
              _DownloadedShortcut(
                onTap: () => Navigator.push<void>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const ReportExportsScreen(),
                  ),
                ),
              ),
            ],
          );
        }
        if (state is! ReportsHubLoaded) return const AppLoadingIndicator();
        return RefreshIndicator(
          onRefresh: context.read<ReportsHubCubit>().load,
          child: ListView(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            children: _sections(state.reports).entries
                .expand(
                  (entry) => <Widget>[
                    Padding(
                      padding: const EdgeInsetsDirectional.only(
                        top: AppSpacing.md,
                        bottom: AppSpacing.sm,
                      ),
                      child: Text(
                        _sectionTitle(entry.key).tr(),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    ...entry.value.map(
                      (report) => Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: AppColors.infoSurfaceColor,
                            child: Icon(
                              _icon(entry.key),
                              color: AppColors.infoColor,
                            ),
                          ),
                          title: Text(report.title),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => _open(report),
                        ),
                      ),
                    ),
                  ],
                )
                .toList(),
          ),
        );
      },
    ),
  );
}

Map<String, List<ReportDefinition>> _sections(List<ReportDefinition> reports) {
  final result = <String, List<ReportDefinition>>{};
  for (final report in reports.where((r) => r.allowed)) {
    (result[report.section] ??= <ReportDefinition>[]).add(report);
  }
  return result;
}

String _sectionTitle(String section) => switch (section) {
  'machines' => LocaleKeys.reportsMachinesSection,
  'transfers' => LocaleKeys.reportsTransfersSection,
  'people' => LocaleKeys.reportsPeopleSection,
  'merchants' => LocaleKeys.reportsMerchantsSection,
  'maintenance' => LocaleKeys.reportsMaintenanceSection,
  _ => LocaleKeys.reportsFinanceSection,
};
IconData _icon(String section) => switch (section) {
  'machines' => Icons.precision_manufacturing_outlined,
  'transfers' => Icons.swap_horiz,
  'people' => Icons.people_outline,
  'merchants' => Icons.storefront_outlined,
  'maintenance' => Icons.build_outlined,
  _ => Icons.account_balance_wallet_outlined,
};

class _DownloadedShortcut extends StatelessWidget {
  const _DownloadedShortcut({required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: const Icon(Icons.offline_pin_outlined),
        label: Text(LocaleKeys.reportsDownloaded.tr()),
      ),
    ),
  );
}
