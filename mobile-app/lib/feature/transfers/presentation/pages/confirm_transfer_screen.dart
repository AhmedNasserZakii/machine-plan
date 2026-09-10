import 'dart:typed_data';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/detail_card.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/theme/styles/app_text_styles.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/data/logic/confirm_transfer/confirm_transfer_cubit.dart';
import 'package:machinery/feature/transfers/data/logic/confirm_transfer/confirm_transfer_state.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';
import 'package:machinery/feature/transfers/presentation/widgets/handover_signature_card.dart';
import 'package:machinery/feature/transfers/presentation/widgets/item_adjustment_sheet.dart';
import 'package:machinery/feature/transfers/presentation/widgets/payload_changed_dialog.dart';
import 'package:machinery/feature/transfers/presentation/widgets/transfer_item_tile.dart';

/// The receiving end of a hand-off: check each machine, correct what is wrong,
/// then sign.
///
/// The order matters. Corrections come before the signature because the
/// signature is *for* the corrected list — signing first and editing after
/// would make the record worthless.
class ConfirmTransferScreen extends StatefulWidget {
  const ConfirmTransferScreen({super.key});

  @override
  State<ConfirmTransferScreen> createState() => _ConfirmTransferScreenState();
}

class _ConfirmTransferScreenState extends State<ConfirmTransferScreen> {
  final HandoverSignatureController _signature = HandoverSignatureController();

  @override
  void dispose() {
    _signature.dispose();
    super.dispose();
  }

  Future<void> _adjust(TransferItemEntity item) async {
    final ConfirmTransferCubit cubit = context.read<ConfirmTransferCubit>();

    final ItemAdjustmentParams? result = await ItemAdjustmentSheet.show(
      context: context,
      item: item,
      current: cubit.state.adjustments[item.id],
    );

    if (result == null) return;

    if (result.isEmpty) {
      cubit.resetAdjustment(item.id);
      return;
    }

    cubit.adjust(
      item.id,
      hasCharger: result.hasCharger,
      hasBox: result.hasBox,
      condition: result.condition,
      batterySerialScanned: result.batterySerialScanned,
      notes: result.notes,
    );
  }

  Future<void> _submit() async {
    if (_signature.method == SignatureMethod.biometric) {
      if (!_signature.isBiometricVerified) {
        showErrorToast(LocaleKeys.signatureBiometricRequired.tr(), context);
        return;
      }

      await context.read<ConfirmTransferCubit>().submit(
        biometricSignature: SignatureParams(
          method: SignatureMethod.biometric,
          deviceId: _signature.verifiedDeviceId,
          deviceModel: _signature.verifiedDeviceModel,
        ),
      );
      return;
    }

    final Uint8List? png = await _signature.drawn.toPngBytes();

    if (!mounted) return;

    if (png == null) {
      showErrorToast(LocaleKeys.transferSignatureRequired.tr(), context);
      return;
    }

    await context.read<ConfirmTransferCubit>().submit(signaturePng: png);
  }

  Future<void> _onStateChanged(
    BuildContext context,
    ConfirmTransferState state,
  ) async {
    if (state.confirmed != null) {
      Navigator.of(context).pop(true);
      return;
    }

    if (state.payloadChanged) {
      // Never auto-retried. The whole point of a signature is that a person
      // signed for a specific set of facts, and those facts just changed.
      await PayloadChangedDialog.show(context);

      if (!context.mounted) return;

      _signature.reset();
      await context.read<ConfirmTransferCubit>().reload();
      return;
    }

    if (state.errorMessage != null) {
      showErrorToast(state.errorMessage!, context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(LocaleKeys.transferConfirmTitle.tr())),
      body: BlocConsumer<ConfirmTransferCubit, ConfirmTransferState>(
        listener: _onStateChanged,
        builder: (BuildContext context, ConfirmTransferState state) {
          return Column(
            children: <Widget>[
              Expanded(child: _buildBody(state)),
              _buildFooter(state),
            ],
          );
        },
      ),
    );
  }

  Widget _buildBody(ConfirmTransferState state) {
    return ListView(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      children: <Widget>[
        Text(
          LocaleKeys.transferConfirmIntro.tr(),
          style: Styles.s13(
            context,
          ).copyWith(color: AppColors.textSecondaryColor),
        ),
        const SizedBox(height: AppSpacing.md),
        ...state.transfer.items.map(
          (TransferItemEntity item) => TransferItemTile(
            item: item,
            isAdjusted: state.adjustments[item.id]?.isEmpty == false,
            trailing: IconButton(
              onPressed: () => _adjust(item),
              icon: const Icon(Icons.edit_outlined, size: 18),
              tooltip: LocaleKeys.edit.tr(),
            ),
          ),
        ),
        if (state.adjustedCount > 0 ||
            state.missingChargerCount > 0 ||
            state.mismatchCount > 0) ...<Widget>[
          const SizedBox(height: AppSpacing.md),
          _AdjustmentSummaryCard(state: state),
        ],
        const SizedBox(height: AppSpacing.md),
        HandoverSignatureCard(
          controller: _signature,
          reason: LocaleKeys.signatureBiometricReasonReceive.tr(),
        ),
      ],
    );
  }

  Widget _buildFooter(ConfirmTransferState state) {
    return SafeArea(
      child: Container(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: const BoxDecoration(
          color: AppColors.surfaceColor,
          border: Border(top: BorderSide(color: AppColors.borderColor)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            CustomButton(
              title: LocaleKeys.transferSubmitSignature.tr(),
              isLoading: state.isSubmitting,
              height: 48,
              width: double.infinity,
              identifier: 'transfer_submit_signature',
              onPressed: state.isSubmitting ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}

/// What the receiver is actually about to sign for, recomputed against his
/// own corrections rather than the sender's original declaration — the same
/// exceptions-lead idea as the sender's review step (`9.3`), placed above the
/// signature pad rather than after it, since the whole point is to read this
/// before, not after.
class _AdjustmentSummaryCard extends StatelessWidget {
  const _AdjustmentSummaryCard({required this.state});

  final ConfirmTransferState state;

  @override
  Widget build(BuildContext context) {
    return DetailCard(
      title: LocaleKeys.transferConfirmSummaryTitle.tr(),
      icon: Icons.fact_check_outlined,
      children: <Widget>[
        if (state.adjustedCount > 0)
          DetailRow(
            label: LocaleKeys.transferItemAdjusted.tr(),
            value: state.adjustedCount.toString(),
          ),
        if (state.missingChargerCount > 0)
          DetailRow(
            label: LocaleKeys.transferItemCharger.tr(),
            value: LocaleKeys.transferReviewMissingChargers.tr(
              args: <String>[state.missingChargerCount.toString()],
            ),
            valueColor: AppColors.warningColor,
          ),
        if (state.mismatchCount > 0)
          DetailRow(
            label: LocaleKeys.transferItemBatteryMismatch.tr(),
            value: LocaleKeys.transferReviewMismatches.tr(
              args: <String>[state.mismatchCount.toString()],
            ),
            valueColor: AppColors.dangerColor,
          ),
      ],
    );
  }
}
