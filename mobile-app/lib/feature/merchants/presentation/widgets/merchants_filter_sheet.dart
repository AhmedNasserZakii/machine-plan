import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/filter_choice_row.dart';
import 'package:machinery/core/shared_widgets/filter_section.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/merchants/domain/params/merchants_query_params.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

/// The merchants filter sheet.
///
/// The branch row only appears for someone who can see past their own — a
/// representative gets a one-option filter otherwise, which is noise.
class MerchantsFilterSheet extends StatefulWidget {
  const MerchantsFilterSheet({
    required this.branches,
    required this.current,
    super.key,
  });

  final List<BranchEntity> branches;
  final MerchantsQueryParams current;

  static Future<MerchantsQueryParams?> show({
    required BuildContext context,
    required List<BranchEntity> branches,
    required MerchantsQueryParams current,
  }) {
    return showModalBottomSheet<MerchantsQueryParams>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) =>
          MerchantsFilterSheet(branches: branches, current: current),
    );
  }

  @override
  State<MerchantsFilterSheet> createState() => _MerchantsFilterSheetState();
}

class _MerchantsFilterSheetState extends State<MerchantsFilterSheet> {
  String? _branchId;
  bool? _hasMachines;
  bool _includeInactive = false;

  @override
  void initState() {
    super.initState();
    _branchId = widget.current.branchId;
    _hasMachines = widget.current.hasMachines;
    _includeInactive = widget.current.includeInactive;
  }

  MerchantsQueryParams get _result {
    return widget.current.copyWith(
      page: 1,
      branchId: _branchId,
      hasMachines: _hasMachines,
      includeInactive: _includeInactive,
      resetBranch: _branchId == null,
      resetHasMachines: _hasMachines == null,
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                LocaleKeys.merchantsFilterTitle.tr(),
                style: Styles.s17(context),
              ),
              const SizedBox(height: AppSpacing.lg),

              if (widget.branches.length > 1)
                FilterSection(
                  title: LocaleKeys.merchantsFilterBranch.tr(),
                  child: FilterChoiceRow(
                    labels: <String>[
                      LocaleKeys.userFilterAll.tr(),
                      ...widget.branches.map((BranchEntity b) => b.name),
                    ],
                    values: <String?>[
                      null,
                      ...widget.branches.map((BranchEntity b) => b.id),
                    ],
                    selected: _branchId,
                    onSelected: (String? value) =>
                        setState(() => _branchId = value),
                  ),
                ),

              FilterSection(
                title: LocaleKeys.merchantsFilterHolding.tr(),
                child: FilterChoiceRow(
                  labels: <String>[
                    LocaleKeys.userFilterAll.tr(),
                    LocaleKeys.merchantsFilterHoldingWith.tr(),
                    LocaleKeys.merchantsFilterHoldingWithout.tr(),
                  ],
                  values: const <String?>[null, 'yes', 'no'],
                  selected: switch (_hasMachines) {
                    true => 'yes',
                    false => 'no',
                    null => null,
                  },
                  onSelected: (String? value) => setState(
                    () => _hasMachines = switch (value) {
                      'yes' => true,
                      'no' => false,
                      _ => null,
                    },
                  ),
                ),
              ),

              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                value: _includeInactive,
                onChanged: (bool value) =>
                    setState(() => _includeInactive = value),
                title: Text(
                  LocaleKeys.merchantsFilterIncludeInactive.tr(),
                  style: Styles.s14(context),
                ),
                subtitle: Text(
                  LocaleKeys.merchantsFilterIncludeInactiveHint.tr(),
                  style: Styles.s12(
                    context,
                  ).copyWith(color: AppColors.textSecondaryColor),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),
              CustomButton(
                title: LocaleKeys.confirm.tr(),
                isLoading: false,
                height: 48,
                identifier: 'merchants_filter_apply',
                onPressed: () => Navigator.of(context).pop(_result),
              ),
              const SizedBox(height: AppSpacing.sm),
              CustomButton(
                title: LocaleKeys.userClearFilters.tr(),
                isLoading: false,
                isStroked: true,
                height: 48,
                onPressed: () =>
                    Navigator.of(context).pop(widget.current.cleared()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
