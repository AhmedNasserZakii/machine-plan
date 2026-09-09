import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/permission_gate.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/machines/data/logic/machine_detail/machine_detail_cubit.dart';
import 'package:machinery/feature/machines/data/logic/machine_detail/machine_detail_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_chain_card.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_cost_card.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_detail_header.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_identity_card.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_purchase_card.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_warranty_card.dart';

/// Everything known about one unit.
///
/// Pops `true` when something changed, so the list behind it refreshes rather
/// than showing a row the user just edited.
class MachineDetailScreen extends StatefulWidget {
  const MachineDetailScreen({super.key});

  @override
  State<MachineDetailScreen> createState() => _MachineDetailScreenState();
}

class _MachineDetailScreenState extends State<MachineDetailScreen> {
  bool _didChange = false;

  @override
  void initState() {
    super.initState();
    context.read<MachineDetailCubit>().load();
  }

  Future<void> _edit(MachineEntity machine) async {
    final bool? saved = await AppRoute.goToMachineForm(
      context: context,
      existing: machine,
    );

    if (!(saved ?? false) || !mounted) {
      return;
    }

    _didChange = true;
    await context.read<MachineDetailCubit>().load();
  }

  /// A chain link opens as its own detail screen rather than swapping the
  /// record in place, so back still means back.
  void _openChainLink(MachineEntity link) {
    AppRoute.goToMachineDetail(context: context, machineId: link.id);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope<Object?>(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? _) {
        if (!didPop) {
          Navigator.of(context).pop(_didChange);
        }
      },
      child: Scaffold(
        appBar: AppBar(
          leading: const ArrowBackWidget(),
          title: Text(LocaleKeys.machinesTitle.tr()),
        ),
        body: BlocBuilder<MachineDetailCubit, MachineDetailState>(
          builder: (BuildContext context, MachineDetailState state) {
            return switch (state) {
              MachineDetailFailure(
                :final String errorMessage,
                :final bool isOffline,
              ) =>
                AppErrorView(
                  message: isOffline
                      ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                      : errorMessage,
                  onRetry: () => context.read<MachineDetailCubit>().load(),
                ),
              MachineDetailLoaded() => _buildBody(context, state),
              _ => const AppLoadingIndicator(),
            };
          },
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, MachineDetailLoaded state) {
    final MachineEntity machine = state.machine;

    return RefreshIndicator(
      onRefresh: () => context.read<MachineDetailCubit>().load(),
      child: ListView(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        children: <Widget>[
          MachineDetailHeader(machine: machine),
          const SizedBox(height: AppSpacing.md),
          MachineIdentityCard(machine: machine),
          const SizedBox(height: AppSpacing.md),
          MachineWarrantyCard(warranty: machine.warranty),
          const SizedBox(height: AppSpacing.md),
          MachineCostCard(
            maintenance: machine.maintenance,
            purchase: machine.purchase,
          ),
          const SizedBox(height: AppSpacing.md),
          MachinePurchaseCard(purchase: machine.purchase),
          if (state.hasChain) ...<Widget>[
            const SizedBox(height: AppSpacing.md),
            MachineChainCard(
              chain: state.chain,
              currentId: machine.id,
              onTap: _openChainLink,
            ),
          ],
          // A retired unit has nothing left to edit, so the button goes rather
          // than being shown and then refused by the server.
          if (!machine.isRetired) ...<Widget>[
            const SizedBox(height: AppSpacing.lg),
            PermissionGate(
              permission: P.machinesUpdate,
              child: OutlinedButton.icon(
                onPressed: () => _edit(machine),
                icon: const Icon(Icons.edit_outlined, size: 18),
                label: Semantics(
                  identifier: 'machine_edit_button',
                  child: Text(LocaleKeys.machineEditTitle.tr()),
                ),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.xxl),
        ],
      ),
    );
  }
}
