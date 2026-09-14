import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/presentation/helpers/merchant_labels.dart';

/// Everything that ever happened with this merchant, newest first: machines in,
/// machines back, plans started, money taken.
class MerchantTimelineCard extends StatelessWidget {
  const MerchantTimelineCard({
    required this.entries,
    super.key,
    this.hasNext = false,
    this.isLoadingMore = false,
    this.onLoadMore,
  });

  final List<MerchantTimelineEntry> entries;
  final bool hasNext;
  final bool isLoadingMore;
  final VoidCallback? onLoadMore;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: LocaleKeys.merchantTimelineCard.tr(),
      icon: Icons.history_rounded,
      children: <Widget>[
        if (entries.isEmpty)
          DetailNote(LocaleKeys.merchantTimelineEmpty.tr())
        else
          ...entries.map(
            (MerchantTimelineEntry entry) => _TimelineRow(entry: entry),
          ),
        if (hasNext || isLoadingMore)
          Align(
            alignment: AlignmentDirectional.center,
            child: isLoadingMore
                ? const Padding(
                    padding: EdgeInsetsDirectional.symmetric(
                      vertical: AppSpacing.sm,
                    ),
                    child: AppLoadingIndicator(size: 28),
                  )
                : IconButton(
                    onPressed: onLoadMore,
                    icon: const Icon(Icons.expand_more_rounded),
                  ),
          ),
      ],
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.entry});

  final MerchantTimelineEntry entry;

  @override
  Widget build(BuildContext context) {
    final Color color = _colorOf(entry.kind);

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(_iconOf(entry.kind), size: 18, color: color),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  MerchantLabels.timelineCode(entry.code),
                  style: Styles.s13(
                    context,
                  ).copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  Formatters.dateTime(entry.occurredAt),
                  style: Styles.s12(
                    context,
                  ).copyWith(color: AppColors.textSecondaryColor),
                ),
                if (entry.machineSerial != null)
                  LtrText(
                    entry.machineSerial!,
                    style: Styles.s12(
                      context,
                    ).copyWith(color: AppColors.textSecondaryColor),
                  ),
              ],
            ),
          ),
          if (entry.amount != null)
            LtrText(
              Formatters.currency(entry.amount!),
              style: Styles.s13(
                context,
              ).copyWith(fontWeight: FontWeight.w700, color: color),
            ),
        ],
      ),
    );
  }

  static IconData _iconOf(MerchantTimelineKind kind) {
    return switch (kind) {
      MerchantTimelineKind.transfer => Icons.swap_horiz_rounded,
      MerchantTimelineKind.subscriptionStarted => Icons.event_repeat_rounded,
      MerchantTimelineKind.collection => Icons.payments_outlined,
      MerchantTimelineKind.unknown => Icons.circle_outlined,
    };
  }

  static Color _colorOf(MerchantTimelineKind kind) {
    return switch (kind) {
      MerchantTimelineKind.transfer => AppColors.infoColor,
      MerchantTimelineKind.subscriptionStarted => AppColors.primaryColor,
      MerchantTimelineKind.collection => AppColors.successColor,
      MerchantTimelineKind.unknown => AppColors.neutralColor,
    };
  }
}
