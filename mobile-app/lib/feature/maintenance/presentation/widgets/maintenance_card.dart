import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/status_chip.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/presentation/helpers/maintenance_labels.dart';

class MaintenanceCard extends StatelessWidget {
  const MaintenanceCard({required this.order, required this.onTap, super.key});

  final MaintenanceOrderEntity order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: LtrText(
                      order.referenceNo,
                      style: Styles.s13(
                        context,
                      ).copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                  StatusChip(
                    label: MaintenanceLabels.status(order.status),
                    color: MaintenanceLabels.statusColor(order.status),
                    icon: MaintenanceLabels.statusIcon(order.status),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              LtrText(
                order.machine.serial,
                style: Styles.mono(
                  context,
                ).copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              Text(
                order.location.name,
                style: Styles.s12(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
              ),
              const SizedBox(height: 4),
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      Formatters.dateTime(order.sentAt),
                      style: Styles.s12(
                        context,
                      ).copyWith(color: AppColors.textSecondaryColor),
                    ),
                  ),
                  if (order.cost != null)
                    Text(
                      Formatters.currency(order.cost!),
                      style: Styles.s13(
                        context,
                      ).copyWith(fontWeight: FontWeight.w700),
                    )
                  else if (order.isFreeUnderWarranty)
                    Text(
                      LocaleKeys.maintenanceFreeUnderWarranty.tr(),
                      style: Styles.s12(
                        context,
                      ).copyWith(color: AppColors.successColor),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
