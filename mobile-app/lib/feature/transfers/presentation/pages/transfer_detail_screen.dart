import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/permissions/permission_keys.dart';
import 'package:machinery/core/permissions/permission_service.dart';
import 'package:machinery/core/shared_widgets/app_error_view.dart';
import 'package:machinery/core/shared_widgets/app_loading_indicator.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/shared_widgets/success_toast.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/app_route.dart';
import 'package:machinery/feature/transfers/data/logic/transfer_detail/transfer_detail_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/transfer_detail/transfer_detail_state.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_actions_bar.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_detail_header.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_item_tile.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_reason_sheet.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_signatures_card.dart';

/// One hand-off document, with the actions available on it.
///
/// Pops `true` when something changed, so the list behind it reloads rather
/// than showing a transfer that has since been signed for.
class TransferDetailScreen extends StatefulWidget {
  const TransferDetailScreen({super.key});

  @override
  State<TransferDetailScreen> createState() => _TransferDetailScreenState();
}

class _TransferDetailScreenState extends State<TransferDetailScreen> {
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    context.read<TransferDetailCubit>().load();
  }

  Future<void> _confirm(TransferEntity transfer) async {
    final bool? confirmed = await AppRoute.goToConfirmTransfer(
      context: context,
      transfer: transfer,
    );

    if (!(confirmed ?? false) || !mounted) return;

    _changed = true;
    await context.read<TransferDetailCubit>().load();
  }

  Future<void> _reject() async {
    final String? reason = await TransferReasonSheet.show(
      context: context,
      title: LocaleKeys.transferRejectTitle.tr(),
      hint: LocaleKeys.transferRejectHint.tr(),
      warning: LocaleKeys.transferRejectWarning.tr(),
      isRequired: true,
    );

    if (reason == null || !mounted) return;

    _changed = true;
    await context.read<TransferDetailCubit>().reject(reason);
  }

  Future<void> _cancel() async {
    final String? reason = await TransferReasonSheet.show(
      context: context,
      title: LocaleKeys.transferCancelTitle.tr(),
      hint: LocaleKeys.transferCancelHint.tr(),
      isRequired: false,
    );

    if (reason == null || !mounted) return;

    _changed = true;
    await context.read<TransferDetailCubit>().cancel(
      reason.isEmpty ? null : reason,
    );
  }

  void _onStateChanged(BuildContext context, TransferDetailState state) {
    if (state is! TransferDetailLoaded) return;

    if (state.actionMessage != null) {
      showSuccessToast(state.actionMessage!, context);
    }
    if (state.actionError != null) {
      showErrorToast(state.actionError!, context);
    }

    context.read<TransferDetailCubit>().consumeMessages();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope<Object?>(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? _) {
        if (!didPop) Navigator.of(context).pop(_changed);
      },
      child: Scaffold(
        appBar: AppBar(title: Text(LocaleKeys.transfersTitle.tr())),
        body: BlocConsumer<TransferDetailCubit, TransferDetailState>(
          listener: _onStateChanged,
          builder: (BuildContext context, TransferDetailState state) {
            return switch (state) {
              TransferDetailFailure(
                :final String errorMessage,
                :final bool isOffline,
              ) =>
                AppErrorView(
                  message: isOffline
                      ? LocaleKeys.transfersOnlineOnlySubtitle.tr()
                      : errorMessage,
                  onRetry: () => context.read<TransferDetailCubit>().load(),
                ),
              TransferDetailLoaded() => _buildDetail(state),
              _ => const AppLoadingIndicator(),
            };
          },
        ),
      ),
    );
  }

  Widget _buildDetail(TransferDetailLoaded state) {
    final TransferEntity transfer = state.transfer;

    return Column(
      children: <Widget>[
        Expanded(
          child: ListView(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            children: <Widget>[
              TransferDetailHeader(transfer: transfer),
              const SizedBox(height: AppSpacing.md),
              DetailCard(
                title: LocaleKeys.transferMachinesTitle.tr(),
                icon: Icons.point_of_sale_outlined,
                children: transfer.items
                    .map(
                      (TransferItemEntity item) => TransferItemTile(item: item),
                    )
                    .toList(growable: false),
              ),
              const SizedBox(height: AppSpacing.md),
              TransferSignaturesCard(
                transferId: transfer.id,
                signatures: transfer.signatures,
              ),
            ],
          ),
        ),
        // Only a pending transfer has anything to do. A confirmed one is a
        // record, and a rejected one is an argument that already happened.
        //
        // Each action is gated on its own permission rather than bundled
        // behind `transfersConfirm` — a representative holds that one but not
        // `transfersReject`/`transfersCancel`, and showing a button the
        // server will 403 on is worse than not showing it at all.
        if (transfer.isPending)
          ValueListenableBuilder<List<String>>(
            valueListenable: getIt<PermissionService>().permissions,
            builder: (BuildContext context, List<String> permissions, _) {
              final PermissionService service = getIt<PermissionService>();

              return TransferActionsBar(
                isBusy: state.isActing,
                onConfirm: service.has(P.transfersConfirm)
                    ? () => _confirm(transfer)
                    : null,
                onReject: service.has(P.transfersReject) ? _reject : null,
                onCancel: service.has(P.transfersCancel) ? _cancel : null,
              );
            },
          ),
      ],
    );
  }
}
