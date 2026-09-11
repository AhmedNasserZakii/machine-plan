import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/custom_search_bar.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/data/logic/machines_list/machines_list_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machines_list/machines_list_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';

/// The optional machine a hand-raised violation is about — a single-select
/// search over the whole `GET /machines` register, not scoped to any one
/// holder's custody the way `MachinePickerSheet` (transfers) is.
class ViolationMachinePickerSheet extends StatefulWidget {
  const ViolationMachinePickerSheet({super.key});

  static Future<MachineEntity?> show({required BuildContext context}) {
    return showModalBottomSheet<MachineEntity>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (_) => const ViolationMachinePickerSheet(),
    );
  }

  @override
  State<ViolationMachinePickerSheet> createState() =>
      _ViolationMachinePickerSheetState();
}

class _ViolationMachinePickerSheetState
    extends State<ViolationMachinePickerSheet> {
  final TextEditingController _searchController = TextEditingController();
  late final MachinesListCubit _cubit;

  @override
  void initState() {
    super.initState();
    _cubit = getIt<MachinesListCubit>();
    _cubit.load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _cubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: FractionallySizedBox(
        heightFactor: 0.85,
        child: BlocProvider<MachinesListCubit>.value(
          value: _cubit,
          child: Column(
            children: <Widget>[
              _PickerHeader(title: LocaleKeys.violationSelectMachine.tr()),
              Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.md,
                ),
                child: CustomSearchBar(
                  controller: _searchController,
                  identifier: 'violation_machine_picker_search',
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
                            return Semantics(
                              identifier:
                                  'violation_machine_picker_row_${machine.id}',
                              child: ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: const Icon(Icons.inventory_2_outlined),
                                title: LtrText(
                                  machine.serial,
                                  style: Styles.mono(
                                    context,
                                  ).copyWith(fontWeight: FontWeight.w700),
                                ),
                                subtitle: Text(
                                  machine.model.name,
                                  style: Styles.s12(context).copyWith(
                                    color: AppColors.textSecondaryColor,
                                  ),
                                ),
                                onTap: () => Navigator.of(context).pop(machine),
                              ),
                            );
                          },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PickerHeader extends StatelessWidget {
  const _PickerHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: Row(
        children: <Widget>[
          Expanded(child: Text(title, style: Styles.s17(context))),
          IconButton(
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.close_rounded),
          ),
        ],
      ),
    );
  }
}
