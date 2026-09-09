import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/theme/styles/status_colors.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/violations/data/logic/violation_summary/violation_summary_cubit.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/presentation/helpers/violation_labels.dart';

/// One representative's whole record on a page: how many, of what kind, what it
/// has cost, and whether it is getting better or worse.
class ViolationSummaryScreen extends StatefulWidget {
  const ViolationSummaryScreen({super.key});

  @override
  State<ViolationSummaryScreen> createState() => _ViolationSummaryScreenState();
}

class _ViolationSummaryScreenState extends State<ViolationSummaryScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ViolationSummaryCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.violationSummaryTitle.tr()),
      ),
      body: BlocBuilder<ViolationSummaryCubit, ViolationSummaryState>(
        builder: (BuildContext context, ViolationSummaryState state) {
          return switch (state) {
            ViolationSummaryFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<ViolationSummaryCubit>().load(),
              ),
            ViolationSummaryLoaded(:final ViolationSummary summary) =>
              _buildBody(context, summary),
            ViolationSummaryLoading() => const AppLoadingIndicator(),
          };
        },
      ),
    );
  }

  Widget _buildBody(BuildContext context, ViolationSummary summary) {
    return ListView(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      children: <Widget>[
        _PersonCard(summary: summary),
        const SizedBox(height: AppSpacing.md),
        _TotalsCard(summary: summary),
        const SizedBox(height: AppSpacing.md),
        if (summary.byType.isNotEmpty) _ByTypeCard(rows: summary.byType),
      ],
    );
  }
}

class _PersonCard extends StatelessWidget {
  const _PersonCard({required this.summary});

  final ViolationSummary summary;

  @override
  Widget build(BuildContext context) {
    final Color trendColor = ViolationLabels.trendColor(summary.trend);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surfaceColor,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            summary.user.fullName,
            style: Styles.s20(context).copyWith(fontWeight: FontWeight.w700),
          ),
          if (summary.branch != null) ...<Widget>[
            const SizedBox(height: AppSpacing.xs),
            Text(
              summary.branch!,
              style: Styles.s13(
                context,
              ).copyWith(color: AppColors.textSecondaryColor),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Row(
            children: <Widget>[
              Icon(
                ViolationLabels.trendIcon(summary.trend),
                size: 18,
                color: trendColor,
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                '${LocaleKeys.violationSummaryTrend.tr()}: '
                '${ViolationLabels.trend(summary.trend)}',
                style: Styles.s14(
                  context,
                ).copyWith(color: trendColor, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TotalsCard extends StatelessWidget {
  const _TotalsCard({required this.summary});

  final ViolationSummary summary;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: LocaleKeys.violationsTitle.tr(),
      icon: Icons.summarize_outlined,
      children: <Widget>[
        DetailRow(
          label: LocaleKeys.violationSummaryOpen.tr(),
          value: summary.totals.open.toString(),
          valueColor: summary.totals.open > 0 ? AppColors.dangerColor : null,
        ),
        DetailRow(
          label: LocaleKeys.violationSummaryCharged.tr(),
          value: summary.totals.charged.toString(),
        ),
        DetailRow(
          label: LocaleKeys.violationSummaryWaived.tr(),
          value: summary.totals.waived.toString(),
        ),
        DetailRow(
          label: LocaleKeys.violationSummaryTotal.tr(),
          valueWidget: LtrText(
            Formatters.currency(summary.totalCharged),
            style: Styles.s14(context).copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        if (summary.bySeverity.isNotEmpty) ...<Widget>[
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: ViolationLabels.filterableSeverities
                .where(
                  (ViolationSeverity severity) =>
                      (summary.bySeverity[severity] ?? 0) > 0,
                )
                .map(
                  (ViolationSeverity severity) => _SeverityPill(
                    severity: severity,
                    count: summary.bySeverity[severity]!,
                  ),
                )
                .toList(growable: false),
          ),
        ],
      ],
    );
  }
}

class _SeverityPill extends StatelessWidget {
  const _SeverityPill({required this.severity, required this.count});

  final ViolationSeverity severity;
  final int count;

  @override
  Widget build(BuildContext context) {
    final Color color = StatusColors.forViolationSeverity(severity);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: StatusColors.surfaceFor(color),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        '${ViolationLabels.severity(severity)} · $count',
        style: Styles.s13(
          context,
        ).copyWith(color: color, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _ByTypeCard extends StatelessWidget {
  const _ByTypeCard({required this.rows});

  final List<ViolationTypeCount> rows;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: LocaleKeys.violationSummaryByType.tr(),
      icon: Icons.category_outlined,
      children: rows
          .map(
            (ViolationTypeCount row) => DetailRow(
              label: row.name,
              valueWidget: Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(
                    row.count.toString(),
                    style: Styles.s14(
                      context,
                    ).copyWith(fontWeight: FontWeight.w700),
                  ),
                  if (row.chargedAmount > 0) ...<Widget>[
                    const SizedBox(width: AppSpacing.sm),
                    LtrText(
                      Formatters.currency(row.chargedAmount),
                      style: Styles.s12(
                        context,
                      ).copyWith(color: AppColors.textSecondaryColor),
                    ),
                  ],
                ],
              ),
            ),
          )
          .toList(growable: false),
    );
  }
}
