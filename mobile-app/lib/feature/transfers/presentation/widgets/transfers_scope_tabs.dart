import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/transfers/domain/params/transfers_query_params.dart';

/// Inbox, outbox, everything. Three separate endpoints rather than a filter,
/// because "waiting for my signature" is a question only the server can answer.
class TransfersScopeTabs extends StatelessWidget {
  const TransfersScopeTabs({
    required this.selected,
    required this.onSelected,
    this.incomingCount = 0,
    super.key,
  });

  final TransfersScope selected;
  final ValueChanged<TransfersScope> onSelected;

  /// Shown on the inbox tab. A representative who is owed four signatures
  /// should see that from any tab.
  final int incomingCount;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsetsDirectional.symmetric(horizontal: AppSpacing.md),
      child: Row(
        children: <Widget>[
          _Tab(
            scope: TransfersScope.incoming,
            label: LocaleKeys.transfersTabIncoming.tr(),
            badge: incomingCount,
            isSelected: selected == TransfersScope.incoming,
            onSelected: onSelected,
          ),
          const SizedBox(width: AppSpacing.sm),
          _Tab(
            scope: TransfersScope.outgoing,
            label: LocaleKeys.transfersTabOutgoing.tr(),
            isSelected: selected == TransfersScope.outgoing,
            onSelected: onSelected,
          ),
          const SizedBox(width: AppSpacing.sm),
          _Tab(
            scope: TransfersScope.all,
            label: LocaleKeys.transfersTabAll.tr(),
            isSelected: selected == TransfersScope.all,
            onSelected: onSelected,
          ),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({
    required this.scope,
    required this.label,
    required this.isSelected,
    required this.onSelected,
    this.badge = 0,
  });

  final TransfersScope scope;
  final String label;
  final bool isSelected;
  final ValueChanged<TransfersScope> onSelected;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final Color foreground = isSelected
        ? AppColors.textOnPrimaryColor
        : AppColors.textSecondaryColor;

    return Semantics(
      identifier: 'transfers_tab_${scope.name}',
      selected: isSelected,
      child: ChoiceChip(
        selected: isSelected,
        onSelected: (_) => onSelected(scope),
        showCheckmark: false,
        label: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              label,
              style: Styles.s13(
                context,
              ).copyWith(color: foreground, fontWeight: FontWeight.w600),
            ),
            if (badge > 0) ...<Widget>[
              const SizedBox(width: AppSpacing.xs),
              _Badge(count: badge, isSelected: isSelected),
            ],
          ],
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.count, required this.isSelected});

  final int count;
  final bool isSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.xs,
        vertical: 1,
      ),
      decoration: BoxDecoration(
        color: isSelected
            ? AppColors.textOnPrimaryColor
            : AppColors.warningColor,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        count.toString(),
        style: Styles.s12(context).copyWith(
          color: isSelected
              ? AppColors.primaryColor
              : AppColors.textOnPrimaryColor,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
