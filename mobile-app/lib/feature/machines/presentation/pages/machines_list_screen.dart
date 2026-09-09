import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/custom_search_bar.dart';
import 'package:machinery/core/shared_widgets/paginated_list_view.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/machines/data/logic/machines_list/machines_list_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machines_list/machines_list_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_lookup_result.dart';
import 'package:machinery/feature/machines/domain/params/machines_query_params.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_card.dart';
import 'package:machinery/feature/machines/presentation/widgets/machines_filter_sheet.dart';

/// The fleet register: search by any of the four serials, filter, scan, open.
class MachinesListScreen extends StatefulWidget {
  const MachinesListScreen({super.key});

  @override
  State<MachinesListScreen> createState() => _MachinesListScreenState();
}

class _MachinesListScreenState extends State<MachinesListScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<MachinesListCubit>().load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _openFilters(MachinesListLoaded state) async {
    final MachinesQueryParams? result = await MachinesFilterSheet.show(
      context: context,
      types: state.types,
      branches: state.branches,
      current: state.query,
    );

    if (result == null || !mounted) {
      return;
    }

    await context.read<MachinesListCubit>().applyFilters(result);
  }

  /// A scan is a shortcut to one machine, so a hit opens it directly. On a miss
  /// the scanner keeps the screen and says so itself.
  Future<void> _scan() async {
    final MachineLookupResult? result = await AppRoute.goToScanner(context);

    if (result == null || !mounted) {
      return;
    }

    await _openDetail(result.machine);
  }

  Future<void> _openDetail(MachineEntity machine) async {
    final bool? changed = await AppRoute.goToMachineDetail(
      context: context,
      machineId: machine.id,
    );

    if ((changed ?? false) && mounted) {
      await context.read<MachinesListCubit>().load(showLoader: false);
    }
  }

  Future<void> _openForm() async {
    final bool? created = await AppRoute.goToMachineForm(context: context);

    if ((created ?? false) && mounted) {
      await context.read<MachinesListCubit>().load(showLoader: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(LocaleKeys.machinesTitle.tr()),
        actions: <Widget>[
          IconButton(
            onPressed: _scan,
            icon: Semantics(
              identifier: 'machines_scan_button',
              child: const Icon(Icons.qr_code_scanner_rounded),
            ),
            tooltip: LocaleKeys.scanTitle.tr(),
          ),
        ],
      ),
      floatingActionButton: PermissionGate(
        permission: P.machinesCreate,
        child: FloatingActionButton(
          heroTag: 'machines_add_fab',
          onPressed: _openForm,
          child: Semantics(
            identifier: 'machines_add_button',
            child: const Icon(Icons.add_rounded),
          ),
        ),
      ),
      body: BlocBuilder<MachinesListCubit, MachinesListState>(
        builder: (BuildContext context, MachinesListState state) {
          return switch (state) {
            MachinesListFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<MachinesListCubit>().load(),
              ),
            MachinesListLoaded() => _buildList(context, state),
            _ => const AppLoadingIndicator(),
          };
        },
      ),
    );
  }

  /// True when the list is empty because of a search or filter rather than
  /// because the fleet is empty — only one of those is the user's to fix.
  bool _isNarrowed(MachinesListLoaded state) =>
      state.query.search != null || state.query.hasFilters;

  Widget _buildList(BuildContext context, MachinesListLoaded state) {
    final MachinesListCubit cubit = context.read<MachinesListCubit>();

    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          child: CustomSearchBar(
            controller: _searchController,
            identifier: 'machines_search_field',
            hintText: LocaleKeys.machinesSearchHint.tr(),
            hasActiveFilters: state.query.hasFilters,
            onChanged: cubit.search,
            onFilterPressed: () => _openFilters(state),
          ),
        ),
        Expanded(
          child: PaginatedListView<MachineEntity>(
            items: state.machines,
            hasNext: state.hasNext,
            isLoadingMore: state.isLoadingMore,
            onRefresh: () => cubit.load(showLoader: false),
            onLoadMore: cubit.loadMore,
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.xxl,
            ),
            emptyState: AppEmptyState(
              icon: Icons.point_of_sale_outlined,
              title: _isNarrowed(state)
                  ? LocaleKeys.machinesNoSearchResults.tr()
                  : LocaleKeys.machinesEmptyTitle.tr(),
              subtitle: _isNarrowed(state)
                  ? ''
                  : LocaleKeys.machinesEmptySubtitle.tr(),
            ),
            itemBuilder:
                (BuildContext context, MachineEntity machine, int index) {
                  return MachineCard(
                    machine: machine,
                    onTap: () => _openDetail(machine),
                  );
                },
          ),
        ),
      ],
    );
  }
}
