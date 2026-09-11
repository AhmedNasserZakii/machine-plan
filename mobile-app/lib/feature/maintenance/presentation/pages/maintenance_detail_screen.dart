import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/shared_widgets/status_chip.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_detail/maintenance_detail_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_detail/maintenance_detail_state.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/presentation/helpers/maintenance_labels.dart';
import 'package:machinery/feature/maintenance/presentation/widgets/maintenance_update_sheet.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_reason_sheet.dart';

/// One repair order, with the actions available on its current status
/// (`11.1`). Close (`11.2`) shares this screen's own `MaintenanceDetailCubit`
/// the same way send/receive do — see `MaintenanceCloseScreen`'s doc comment
/// — and is gated on both `maintenance.close` and `maintenance.set_cost`
/// (`11.1`'s own note on why: recording an outcome and deciding who pays for
/// it are meant to be held by different people).
///
/// Pops the updated order when something changed, so the list behind it
/// swaps the one row in place rather than reloading the whole page.
class MaintenanceDetailScreen extends StatefulWidget {
  const MaintenanceDetailScreen({super.key});

  @override
  State<MaintenanceDetailScreen> createState() =>
      _MaintenanceDetailScreenState();
}

class _MaintenanceDetailScreenState extends State<MaintenanceDetailScreen> {
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    context.read<MaintenanceDetailCubit>().load();
  }

  Future<void> _handover({required bool isSend}) async {
    final bool? done = await AppRoute.goToMaintenanceHandover(
      context: context,
      cubit: context.read<MaintenanceDetailCubit>(),
      isSend: isSend,
    );

    if (done ?? false) _changed = true;
  }

  Future<void> _cancel() async {
    final String? reason = await TransferReasonSheet.show(
      context: context,
      title: LocaleKeys.maintenanceCancelTitle.tr(),
      hint: LocaleKeys.maintenanceCancelHint.tr(),
      isRequired: true,
    );

    if (reason == null || !mounted) return;

    _changed = true;
    await context.read<MaintenanceDetailCubit>().cancel(
      CancelMaintenanceOrderParams(reason: reason),
    );
  }

  Future<void> _update(MaintenanceOrderEntity order) async {
    final UpdateMaintenanceOrderParams? params =
        await MaintenanceUpdateSheet.show(context: context, order: order);

    if (params == null || !mounted) return;

    _changed = true;
    await context.read<MaintenanceDetailCubit>().update(params);
  }

  Future<void> _close(MaintenanceOrderEntity order) async {
    final bool? done = await AppRoute.goToMaintenanceClose(
      context: context,
      cubit: context.read<MaintenanceDetailCubit>(),
      order: order,
    );

    if (done ?? false) _changed = true;
  }

  void _onStateChanged(BuildContext context, MaintenanceDetailState state) {
    final MaintenanceDetailCubit cubit = context.read<MaintenanceDetailCubit>();
    final MaintenanceActionOutcome? outcome = cubit.lastOutcome;

    if (outcome != null) {
      final String message = switch (outcome) {
        MaintenanceActionOutcome.sent => LocaleKeys.maintenanceSentSuccess,
        MaintenanceActionOutcome.received =>
          LocaleKeys.maintenanceReceivedSuccess,
        MaintenanceActionOutcome.cancelled =>
          LocaleKeys.maintenanceCancelledSuccess,
        MaintenanceActionOutcome.closed => LocaleKeys.maintenanceClosedSuccess,
        MaintenanceActionOutcome.updated =>
          LocaleKeys.maintenanceUpdatedSuccess,
      }.tr();

      showSuccessToast(message, context);
      cubit.lastOutcome = null;
    }

    if (cubit.lastError != null) {
      showErrorToast(cubit.lastError!, context);
      cubit.lastError = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope<Object?>(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? _) {
        if (didPop) return;

        final MaintenanceDetailState state = context
            .read<MaintenanceDetailCubit>()
            .state;
        final MaintenanceOrderEntity? updated =
            _changed && state is MaintenanceDetailLoaded
            ? state.order
            : null;

        Navigator.of(context).pop(updated);
      },
      child: Scaffold(
        appBar: AppBar(
          leading: const ArrowBackWidget(),
          title: Text(LocaleKeys.maintenanceDetailTitle.tr()),
        ),
        body: BlocConsumer<MaintenanceDetailCubit, MaintenanceDetailState>(
          listener: _onStateChanged,
          builder: (BuildContext context, MaintenanceDetailState state) {
            return switch (state) {
              MaintenanceDetailFailure(
                :final String errorMessage,
                :final bool isOffline,
              ) =>
                AppErrorView(
                  message: isOffline
                      ? LocaleKeys.machinesOnlineOnlySubtitle.tr()
                      : errorMessage,
                  onRetry: () => context.read<MaintenanceDetailCubit>().load(),
                ),
              MaintenanceDetailLoaded() => _buildDetail(context, state),
              _ => const AppLoadingIndicator(),
            };
          },
        ),
      ),
    );
  }

  Widget _buildDetail(BuildContext context, MaintenanceDetailLoaded state) {
    final MaintenanceOrderEntity order = state.order;

    return Column(
      children: <Widget>[
        Expanded(
          child: ListView(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: LtrText(
                      order.referenceNo,
                      style: Styles.s17(
                        context,
                      ).copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                  StatusChip(
                    label: MaintenanceLabels.status(order.status),
                    color: MaintenanceLabels.statusColor(order.status),
                    icon: MaintenanceLabels.statusIcon(order.status),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              DetailCard(
                title: LocaleKeys.maintenanceDetailTitle.tr(),
                icon: Icons.build_circle_outlined,
                children: <Widget>[
                  DetailRow(
                    label: LocaleKeys.violationMachine.tr(),
                    value: order.machine.serial,
                  ),
                  DetailRow(
                    label: LocaleKeys.maintenanceLocation.tr(),
                    value: order.location.name,
                  ),
                  DetailRow(
                    label: LocaleKeys.maintenanceReportedFault.tr(),
                    value: order.reportedFault,
                  ),
                  DetailRow(
                    label: LocaleKeys.maintenanceSentAt.tr(),
                    value: Formatters.dateTime(order.sentAt),
                  ),
                  DetailRow(
                    label: LocaleKeys.maintenanceReturnedAt.tr(),
                    value: order.returnedAt == null
                        ? null
                        : Formatters.dateTime(order.returnedAt!),
                  ),
                  if (order.result != null)
                    DetailRow(
                      label: LocaleKeys.maintenanceCloseResult.tr(),
                      value: MaintenanceLabels.result(order.result!),
                    ),
                  DetailRow(
                    label: LocaleKeys.maintenanceCost.tr(),
                    value: order.cost == null
                        ? (order.isFreeUnderWarranty
                              ? LocaleKeys.maintenanceFreeUnderWarranty.tr()
                              : null)
                        : Formatters.currency(order.cost!),
                  ),
                  if (order.responsibleParty != null)
                    DetailRow(
                      label: LocaleKeys.maintenanceResponsibleParty.tr(),
                      value: MaintenanceLabels.responsibleParty(
                        order.responsibleParty!,
                      ),
                    ),
                  DetailRow(
                    label: LocaleKeys.maintenancePerformedBy.tr(),
                    value: order.performedByName,
                  ),
                  DetailRow(
                    label: LocaleKeys.maintenanceNotes.tr(),
                    value: order.notes,
                  ),
                  if (order.isCancelled) ...<Widget>[
                    DetailRow(
                      label: LocaleKeys.maintenanceCancelledAt.tr(),
                      value: order.cancelledAt == null
                          ? null
                          : Formatters.dateTime(order.cancelledAt!),
                    ),
                    DetailRow(
                      label: LocaleKeys.maintenanceCancelReasonLabel.tr(),
                      value: order.cancelReason,
                    ),
                  ],
                  if (order.isClosed)
                    DetailRow(
                      label: LocaleKeys.maintenanceClosedAt.tr(),
                      value: order.closedAt == null
                          ? null
                          : Formatters.dateTime(order.closedAt!),
                    ),
                ],
              ),
            ],
          ),
        ),
        if (!order.isClosed && !order.isCancelled)
          ValueListenableBuilder<List<String>>(
            valueListenable: getIt<PermissionService>().permissions,
            builder: (BuildContext context, List<String> _, _) {
              final PermissionService service = getIt<PermissionService>();
              final bool canUpdate = service.has(P.maintenanceUpdate);
              final bool canClose = service.hasAll(<String>[
                P.maintenanceClose,
                P.maintenanceSetCost,
              ]);

              return _ActionsBar(
                isBusy: state.actionInProgress,
                onSend: (canUpdate && order.isOpen)
                    ? () => _handover(isSend: true)
                    : null,
                onReceive: (canUpdate && order.isInProgress)
                    ? () => _handover(isSend: false)
                    : null,
                onCancel: (canUpdate && order.canCancel) ? _cancel : null,
                onUpdate: canUpdate ? () => _update(order) : null,
                onClose: (canClose && order.isReturned)
                    ? () => _close(order)
                    : null,
              );
            },
          ),
      ],
    );
  }
}

class _ActionsBar extends StatelessWidget {
  const _ActionsBar({
    required this.isBusy,
    this.onSend,
    this.onReceive,
    this.onCancel,
    this.onUpdate,
    this.onClose,
  });

  final bool isBusy;
  final VoidCallback? onSend;
  final VoidCallback? onReceive;
  final VoidCallback? onCancel;
  final VoidCallback? onUpdate;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final List<Widget> buttons = <Widget>[
      if (onSend != null)
        _ActionButton(
          identifier: 'maintenance_action_send',
          label: LocaleKeys.maintenanceActionSend.tr(),
          icon: Icons.outbox_outlined,
          onPressed: isBusy ? null : onSend,
        ),
      if (onReceive != null)
        _ActionButton(
          identifier: 'maintenance_action_receive',
          label: LocaleKeys.maintenanceActionReceive.tr(),
          icon: Icons.move_to_inbox_outlined,
          onPressed: isBusy ? null : onReceive,
        ),
      if (onClose != null)
        _ActionButton(
          identifier: 'maintenance_action_close',
          label: LocaleKeys.maintenanceActionClose.tr(),
          icon: Icons.check_circle_outline_rounded,
          onPressed: isBusy ? null : onClose,
        ),
      if (onUpdate != null)
        _ActionButton(
          identifier: 'maintenance_action_edit',
          label: LocaleKeys.maintenanceActionEdit.tr(),
          icon: Icons.edit_outlined,
          onPressed: isBusy ? null : onUpdate,
        ),
      if (onCancel != null)
        _ActionButton(
          identifier: 'maintenance_action_cancel',
          label: LocaleKeys.maintenanceActionCancel.tr(),
          icon: Icons.cancel_outlined,
          destructive: true,
          onPressed: isBusy ? null : onCancel,
        ),
    ];

    if (buttons.isEmpty) return const SizedBox.shrink();

    return SafeArea(
      child: Container(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: const BoxDecoration(
          color: AppColors.surfaceColor,
          border: Border(top: BorderSide(color: AppColors.borderColor)),
        ),
        child: Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: buttons,
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.identifier,
    required this.label,
    required this.icon,
    required this.onPressed,
    this.destructive = false,
  });

  final String identifier;
  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      identifier: identifier,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 16),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          foregroundColor: destructive ? AppColors.dangerColor : null,
          side: BorderSide(
            color: destructive ? AppColors.dangerColor : AppColors.borderColor,
          ),
        ),
      ),
    );
  }
}
