import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/custom_search_bar.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/machines/data/logic/machine_models_list/machine_models_list_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_models_list/machine_models_list_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_model_card.dart';

/// Admin catalogue of machine models. Creating one needs `settings.manage`.
class MachineModelsListScreen extends StatefulWidget {
  const MachineModelsListScreen({super.key});

  @override
  State<MachineModelsListScreen> createState() =>
      _MachineModelsListScreenState();
}

class _MachineModelsListScreenState extends State<MachineModelsListScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    context.read<MachineModelsListCubit>().load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _openForm({MachineModelEntity? existing}) async {
    final bool? changed = await AppRoute.goToMachineModelForm(
      context: context,
      existing: existing,
    );

    if ((changed ?? false) && mounted) {
      await context.read<MachineModelsListCubit>().load(showLoader: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(LocaleKeys.machineModelsTitle.tr()),
      ),
      floatingActionButton: PermissionGate(
        permission: P.settingsManage,
        child: FloatingActionButton(
          heroTag: 'machine_models_add_fab',
          onPressed: _openForm,
          child: Semantics(
            identifier: 'machine_models_add_button',
            child: const Icon(Icons.add_rounded),
          ),
        ),
      ),
      body: BlocBuilder<MachineModelsListCubit, MachineModelsListState>(
        builder: (BuildContext context, MachineModelsListState state) {
          return switch (state) {
            MachineModelsListFailure(
              :final String errorMessage,
              :final bool isOffline,
            ) =>
              AppErrorView(
                message: isOffline
                    ? LocaleKeys.machineModelsOnlineOnlySubtitle.tr()
                    : errorMessage,
                onRetry: () => context.read<MachineModelsListCubit>().load(),
              ),
            MachineModelsListLoaded() => _buildList(context, state),
            _ => const Center(child: AppLoadingIndicator()),
          };
        },
      ),
    );
  }

  Widget _buildList(BuildContext context, MachineModelsListLoaded state) {
    final List<MachineModelEntity> visible = state.visible;

    return RefreshIndicator(
      onRefresh: () => context.read<MachineModelsListCubit>().load(
        showLoader: false,
      ),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: <Widget>[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: CustomSearchBar(
                controller: _searchController,
                hintText: LocaleKeys.machineModelsSearchHint.tr(),
                identifier: 'machine_models_search',
                onChanged: context.read<MachineModelsListCubit>().search,
              ),
            ),
          ),
          if (visible.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: AppEmptyState(
                title: state.search.trim().isEmpty
                    ? LocaleKeys.machineModelsEmptyTitle.tr()
                    : LocaleKeys.machineModelsNoSearchResults.tr(),
                subtitle: state.search.trim().isEmpty
                    ? LocaleKeys.machineModelsEmptySubtitle.tr()
                    : LocaleKeys.machineModelsNoSearchResults.tr(),
                icon: Icons.devices_other_outlined,
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                0,
                AppSpacing.md,
                AppSpacing.xxl,
              ),
              sliver: SliverList.separated(
                itemCount: visible.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(height: AppSpacing.sm),
                itemBuilder: (BuildContext context, int index) {
                  final MachineModelEntity model = visible[index];
                  return MachineModelCard(
                    model: model,
                    onTap: () => _openForm(existing: model),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
