import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/custom_search_bar.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/data/logic/machines_list/machines_list_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machines_list/machines_list_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/params/machines_query_params.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_status_chip.dart';

/// A searchable, multi-select list of the machines currently in one party's
/// custody (`9.1`) — the alternative to scanning forty stickers one at a time
/// when the machines are already known, e.g. clearing an entire branch
/// warehouse in one hand-off.
///
/// "Cached" means the fetch happens once per opening rather than once per
/// keystroke: [MachinesListCubit] already debounces search server-side and
/// keeps the page it has while a new one loads, so reopening this sheet mid
/// wizard never re-pays for a page already on screen.
class MachinePickerSheet extends StatefulWidget {
  const MachinePickerSheet({
    required this.holderId,
    required this.isSelectable,
    required this.alreadySelectedIds,
    super.key,
  });

  final String holderId;

  /// A machine that fails this cannot go this way — greyed out rather than
  /// hidden, so the rep sees it exists and why it is not offered.
  final bool Function(MachineEntity machine) isSelectable;

  final Set<String> alreadySelectedIds;

  /// Returns the machines the user picked, or `null` if he backed out.
  static Future<List<MachineEntity>?> show({
    required BuildContext context,
    required String holderId,
    required bool Function(MachineEntity machine) isSelectable,
    required Set<String> alreadySelectedIds,
  }) {
    return showModalBottomSheet<List<MachineEntity>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => MachinePickerSheet(
        holderId: holderId,
        isSelectable: isSelectable,
        alreadySelectedIds: alreadySelectedIds,
      ),
    );
  }

  @override
  State<MachinePickerSheet> createState() => _MachinePickerSheetState();
}

class _MachinePickerSheetState extends State<MachinePickerSheet> {
  final TextEditingController _searchController = TextEditingController();
  final Set<String> _selectedIds = <String>{};
  late final MachinesListCubit _cubit;

  @override
  void initState() {
    super.initState();
    _cubit = getIt<MachinesListCubit>();
    _cubit.load(
      params: MachinesQueryParams(holderId: widget.holderId, limit: 100),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    _cubit.close();
    super.dispose();
  }

  void _toggle(MachineEntity machine) {
    if (widget.alreadySelectedIds.contains(machine.id) ||
        !widget.isSelectable(machine)) {
      return;
    }

    setState(() {
      if (!_selectedIds.remove(machine.id)) {
        _selectedIds.add(machine.id);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: FractionallySizedBox(
        heightFactor: 0.88,
        child: BlocProvider<MachinesListCubit>.value(
          value: _cubit,
          child: Column(
            children: <Widget>[
              Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.sm,
                ),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        LocaleKeys.transferPickerTitle.tr(),
                        style: Styles.s17(context),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.md,
                ),
                child: CustomSearchBar(
                  controller: _searchController,
                  identifier: 'machine_picker_search_field',
                  hintText: LocaleKeys.transferPickerSearchHint.tr(),
                  onChanged: _cubit.search,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Expanded(
                child: BlocBuilder<MachinesListCubit, MachinesListState>(
                  bloc: _cubit,
                  builder: (BuildContext context, MachinesListState state) {
                    if (state is! MachinesListLoaded) {
                      return const AppLoadingIndicator();
                    }

                    return PaginatedListView<MachineEntity>(
                      items: state.machines,
                      hasNext: state.hasNext,
                      isLoadingMore: state.isLoadingMore,
                      onRefresh: () => _cubit.load(showLoader: false),
                      onLoadMore: _cubit.loadMore,
                      padding: const EdgeInsetsDirectional.fromSTEB(
                        AppSpacing.md,
                        0,
                        AppSpacing.md,
                        AppSpacing.md,
                      ),
                      emptyState: AppEmptyState(
                        icon: Icons.inventory_2_outlined,
                        title: LocaleKeys.transferPickerEmpty.tr(),
                        subtitle: '',
                      ),
                      itemBuilder:
                          (BuildContext context, MachineEntity machine, int _) {
                            final bool alreadyAdded = widget.alreadySelectedIds
                                .contains(machine.id);
                            final bool eligible = widget.isSelectable(machine);
                            final bool checked =
                                alreadyAdded || _selectedIds.contains(machine.id);

                            return _PickerRow(
                              machine: machine,
                              checked: checked,
                              enabled: !alreadyAdded && eligible,
                              disabledReason: alreadyAdded
                                  ? LocaleKeys.transferMachineAlreadyAdded.tr()
                                  : (!eligible
                                        ? LocaleKeys.transferMachineNotEligible
                                              .tr()
                                        : null),
                              onTap: () => _toggle(machine),
                            );
                          },
                    );
                  },
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                  child: CustomButton(
                    title: _selectedIds.isEmpty
                        ? LocaleKeys.transferPickerAddSelected.tr(args: ['0'])
                        : LocaleKeys.transferPickerAddSelected.tr(
                            args: ['${_selectedIds.length}'],
                          ),
                    isLoading: false,
                    height: 48,
                    width: double.infinity,
                    identifier: 'machine_picker_confirm',
                    onPressed: _selectedIds.isEmpty
                        ? null
                        : () {
                            final MachinesListState state = _cubit.state;
                            if (state is! MachinesListLoaded) return;

                            final List<MachineEntity> picked = state.machines
                                .where(
                                  (MachineEntity machine) =>
                                      _selectedIds.contains(machine.id),
                                )
                                .toList(growable: false);

                            Navigator.of(context).pop(picked);
                          },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PickerRow extends StatelessWidget {
  const _PickerRow({
    required this.machine,
    required this.checked,
    required this.enabled,
    required this.onTap,
    this.disabledReason,
  });

  final MachineEntity machine;
  final bool checked;
  final bool enabled;
  final String? disabledReason;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled || checked ? 1 : 0.5,
      child: Semantics(
        identifier: 'machine_picker_row_${machine.serial}',
        child: Material(
          type: MaterialType.transparency,
          child: CheckboxListTile(
            value: checked,
            onChanged: enabled ? (_) => onTap() : null,
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            title: LtrText(
              machine.serial,
              style: Styles.mono(context).copyWith(fontWeight: FontWeight.w700),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  machine.model.name,
                  style: Styles.s12(
                    context,
                  ).copyWith(color: AppColors.textSecondaryColor),
                ),
                if (disabledReason != null && !checked)
                  Text(
                    disabledReason!,
                    style: Styles.s12(
                      context,
                    ).copyWith(color: AppColors.dangerColor),
                  ),
              ],
            ),
            secondary: MachineStatusChip(status: machine.status),
          ),
        ),
      ),
    );
  }
}
