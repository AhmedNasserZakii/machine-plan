import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/app_empty_state.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/ltr_text.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/feature/machines/presentation/widgets/machine_status_chip.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_state.dart';

/// Step two: which machines are physically going.
///
/// Adding is by scan rather than by search. The machines are in front of the
/// person, the stickers are on them, and typing forty serials is how the wrong
/// unit ends up on a delivery note.
class TransferMachinesStep extends StatelessWidget {
  const TransferMachinesStep({
    required this.state,
    required this.onScan,
    super.key,
  });

  final CreateTransferState state;
  final Future<void> Function() onScan;

  @override
  Widget build(BuildContext context) {
    final CreateTransferCubit cubit = context.read<CreateTransferCubit>();

    return Column(
      children: <Widget>[
        Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          child: CustomButton(
            title: LocaleKeys.transferScanToAdd.tr(),
            isLoading: false,
            height: 48,
            width: double.infinity,
            identifier: 'transfer_scan_add',
            onPressed: onScan,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                const Icon(Icons.qr_code_scanner_rounded, size: 18),
                const SizedBox(width: AppSpacing.sm),
                Text(LocaleKeys.transferScanToAdd.tr()),
              ],
            ),
          ),
        ),
        Expanded(
          child: state.items.isEmpty
              ? AppEmptyState(
                  icon: Icons.qr_code_scanner_rounded,
                  title: LocaleKeys.transferNoMachinesYet.tr(),
                  subtitle: LocaleKeys.transferScanToAdd.tr(),
                )
              : ListView.builder(
                  padding: const EdgeInsetsDirectional.fromSTEB(
                    AppSpacing.md,
                    0,
                    AppSpacing.md,
                    AppSpacing.xxl,
                  ),
                  itemCount: state.items.length,
                  itemBuilder: (BuildContext context, int index) {
                    final DraftItem item = state.items[index];

                    return _DraftRow(
                      item: item,
                      onRemove: () => cubit.removeMachine(item.machine.id),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _DraftRow extends StatelessWidget {
  const _DraftRow({required this.item, required this.onRemove});

  final DraftItem item;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      identifier: 'draft_item_${item.machine.serial}',
      child: Container(
        margin: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.surfaceColor,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: AppColors.borderColor),
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  LtrText(
                    item.machine.serial,
                    style: Styles.mono(
                      context,
                    ).copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    item.machine.model.name,
                    style: Styles.s12(
                      context,
                    ).copyWith(color: AppColors.textSecondaryColor),
                  ),
                ],
              ),
            ),
            MachineStatusChip(status: item.machine.status),
            IconButton(
              onPressed: onRemove,
              icon: const Icon(
                Icons.delete_outline_rounded,
                size: 18,
                color: AppColors.dangerColor,
              ),
              tooltip: LocaleKeys.delete.tr(),
            ),
          ],
        ),
      ),
    );
  }
}
