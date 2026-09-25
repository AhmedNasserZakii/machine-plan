import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/clicked_widget.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/status_chip.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

/// One row in the admin branches list.
class BranchCard extends StatelessWidget {
  const BranchCard({required this.branch, required this.onTap, super.key});

  final BranchEntity branch;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final String? address = branch.address;
    final String? phone = branch.phone;

    return Semantics(
      identifier: 'branch_card_${branch.code}',
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
                      branch.name,
                      style: Styles.s15(
                        context,
                      ).copyWith(fontWeight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (!branch.isActive)
                    StatusChip(
                      label: LocaleKeys.branchInactive.tr(),
                      color: AppColors.neutralColor,
                      icon: Icons.block_outlined,
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              LtrText(
                branch.code,
                style: Styles.s13(
                  context,
                ).copyWith(color: AppColors.textSecondaryColor),
              ),
              if (address != null && address.isNotEmpty) ...<Widget>[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  address,
                  style: Styles.s13(context),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              if (phone != null && phone.isNotEmpty) ...<Widget>[
                const SizedBox(height: AppSpacing.xs),
                LtrText(
                  phone,
                  style: Styles.s12(
                    context,
                  ).copyWith(color: AppColors.textSecondaryColor),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
