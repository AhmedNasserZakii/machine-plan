import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/status_chip.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';

/// One row in the admin machine-models catalogue.
class MachineModelCard extends StatelessWidget {
  const MachineModelCard({required this.model, required this.onTap, super.key});

  final MachineModelEntity model;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final String title = model.nameAr?.isNotEmpty == true
        ? model.nameAr!
        : model.name;

    return Semantics(
      identifier: 'machine_model_card_${model.code}',
      child: ClickedWidget(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.surfaceColor,
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: AppColors.borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      title,
                      style: Styles.s15(
                        context,
                      ).copyWith(fontWeight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (!model.isActive)
                    StatusChip(
                      label: LocaleKeys.userInactive.tr(),
                      color: AppColors.neutralColor,
                      icon: Icons.block_outlined,
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              LtrText(
                model.code,
                style: Styles.s13(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                model.type.name,
                style: Styles.s13(context),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (model.manufacturer != null &&
                  model.manufacturer!.isNotEmpty) ...<Widget>[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  model.manufacturer!,
                  style: Styles.s12(
                    context,
                  ).copyWith(color: AppColors.textSecondaryColor),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
