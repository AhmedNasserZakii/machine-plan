import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

/// Only ever built for a branch-scoped role. A company-level role gets no
/// branch field at all rather than a disabled one — a greyed-out control the
/// user can never satisfy is worse than no control.
class BranchSelector extends StatelessWidget {
  const BranchSelector({
    required this.branches,
    required this.selectedId,
    required this.onChanged,
    super.key,
    this.errorText,
  });

  final List<BranchEntity> branches;
  final String? selectedId;
  final ValueChanged<String> onChanged;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          LocaleKeys.userBranch.tr(),
          style: Styles.s14(context).copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.sm),
        Semantics(
          identifier: 'user_branch_selector',
          child: InputDecorator(
            decoration: InputDecoration(
              errorText: errorText,
              contentPadding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.xs,
              ),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: selectedId,
                isExpanded: true,
                hint: Text(
                  LocaleKeys.userPickBranch.tr(),
                  style: Styles.s14(
                    context,
                  ).copyWith(color: AppColors.textPlaceholderColor),
                ),
                items: branches
                    .map(
                      (BranchEntity branch) => DropdownMenuItem<String>(
                        value: branch.id,
                        child: Text(
                          branch.name,
                          style: Styles.s14(context),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(growable: false),
                onChanged: (String? id) {
                  if (id != null) {
                    onChanged(id);
                  }
                },
              ),
            ),
          ),
        ),
      ],
    );
  }
}
