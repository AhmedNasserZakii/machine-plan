import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/filter_choice_row.dart';
import 'package:machinery/core/shared_widgets/filter_section.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/domain/params/machines_query_params.dart';
import 'package:machinery/feature/machines/presentation/helpers/machine_labels.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

/// The machines filter sheet.
///
/// Status is multi-select — "everything that is out with someone" is a real
/// question, and forcing one status at a time would make it three searches.
class MachinesFilterSheet extends StatefulWidget {
  const MachinesFilterSheet({
    required this.types,
    required this.branches,
    required this.current,
    super.key,
  });

  final List<MachineTypeEntity> types;
  final List<BranchEntity> branches;
  final MachinesQueryParams current;

  static Future<MachinesQueryParams?> show({
    required BuildContext context,
    required List<MachineTypeEntity> types,
    required List<BranchEntity> branches,
    required MachinesQueryParams current,
  }) {
    return showModalBottomSheet<MachinesQueryParams>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => MachinesFilterSheet(
        types: types,
        branches: branches,
        current: current,
      ),
    );
  }

  @override
  State<MachinesFilterSheet> createState() => _MachinesFilterSheetState();
}

class _MachinesFilterSheetState extends State<MachinesFilterSheet> {
  late Set<MachineStatus> _statuses;
  String? _typeId;
  String? _branchId;
  PartyType? _holderType;
  bool _warrantyExpiring = false;
  bool _includeRetired = false;

  /// How far ahead "expiring soon" looks. A month is the notice a branch needs
  /// to get a unit back to the factory before cover lapses.
  static const int _expiringWindowDays = 30;

  @override
  void initState() {
    super.initState();
    _statuses = widget.current.statuses.toSet();
    _typeId = widget.current.machineTypeId;
    _branchId = widget.current.branchId;
    _holderType = widget.current.holderType;
    _warrantyExpiring = widget.current.warrantyExpiringBefore != null;
    _includeRetired = widget.current.includeRetired;
  }

  MachinesQueryParams get _result {
    return widget.current.copyWith(
      page: 1,
      statuses: _statuses.toList(growable: false),
      machineTypeId: _typeId,
      branchId: _branchId,
      holderType: _holderType,
      warrantyExpiringBefore: _warrantyExpiring ? _expiringDate() : null,
      includeRetired: _includeRetired,
      resetType: _typeId == null,
      resetBranch: _branchId == null,
      resetHolderType: _holderType == null,
      resetWarranty: !_warrantyExpiring,
    );
  }

  String _expiringDate() {
    final DateTime cutoff = DateTime.now().add(
      const Duration(days: _expiringWindowDays),
    );

    return cutoff.toIso8601String().split('T').first;
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
                LocaleKeys.machinesFilterTitle.tr(),
                style: Styles.s17(context),
              ),
              const SizedBox(height: AppSpacing.lg),

              FilterSection(
                title: LocaleKeys.machinesFilterStatus.tr(),
                child: _StatusChips(
                  selected: _statuses,
                  onToggle: (MachineStatus status) => setState(() {
                    if (!_statuses.remove(status)) {
                      _statuses.add(status);
                    }
                  }),
                ),
              ),

              if (widget.types.isNotEmpty)
                FilterSection(
                  title: LocaleKeys.machinesFilterType.tr(),
                  child: FilterChoiceRow(
                    labels: <String>[
                      LocaleKeys.userFilterAll.tr(),
                      ...widget.types.map((MachineTypeEntity t) => t.name),
                    ],
                    values: <String?>[
                      null,
                      ...widget.types.map((MachineTypeEntity t) => t.id),
                    ],
                    selected: _typeId,
                    onSelected: (String? value) =>
                        setState(() => _typeId = value),
                  ),
                ),

              if (widget.branches.isNotEmpty)
                FilterSection(
                  title: LocaleKeys.machinesFilterBranch.tr(),
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
                title: LocaleKeys.machinesFilterHolder.tr(),
                child: FilterChoiceRow(
                  labels: <String>[
                    LocaleKeys.userFilterAll.tr(),
                    ...MachineLabels.filterableHolders.map(MachineLabels.party),
                  ],
                  values: <String?>[
                    null,
                    ...MachineLabels.filterableHolders.map(
                      (PartyType type) => type.value,
                    ),
                  ],
                  selected: _holderType?.value,
                  onSelected: (String? value) => setState(
                    () => _holderType = value == null
                        ? null
                        : MachineLabels.filterableHolders.firstWhere(
                            (PartyType type) => type.value == value,
                          ),
                  ),
                ),
              ),

              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                value: _warrantyExpiring,
                onChanged: (bool value) =>
                    setState(() => _warrantyExpiring = value),
                title: Text(
                  LocaleKeys.machinesFilterWarrantyExpiring.tr(),
                  style: Styles.s14(context),
                ),
              ),

              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                value: _includeRetired,
                onChanged: (bool value) =>
                    setState(() => _includeRetired = value),
                title: Text(
                  LocaleKeys.machinesFilterIncludeRetired.tr(),
                  style: Styles.s14(context),
                ),
                subtitle: Text(
                  LocaleKeys.machinesFilterIncludeRetiredHint.tr(),
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
                identifier: 'machines_filter_apply',
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

/// Multi-select status chips. Unlike [FilterChoiceRow] these toggle
/// independently, so there is no "all" chip — no selection already means all.
class _StatusChips extends StatelessWidget {
  const _StatusChips({required this.selected, required this.onToggle});

  final Set<MachineStatus> selected;
  final ValueChanged<MachineStatus> onToggle;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: MachineLabels.filterableStatuses
          .map((MachineStatus status) {
            final bool isSelected = selected.contains(status);

            return FilterChip(
              label: Text(
                MachineLabels.status(status),
                style: Styles.s13(context),
              ),
              selected: isSelected,
              onSelected: (_) => onToggle(status),
              showCheckmark: false,
              backgroundColor: AppColors.surfaceAltColor,
              selectedColor: AppColors.primaryLightColor,
              side: BorderSide(
                color: isSelected
                    ? AppColors.primaryColor
                    : AppColors.borderColor,
              ),
            );
          })
          .toList(growable: false),
    );
  }
}
