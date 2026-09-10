import 'dart:typed_data';

import 'package:dartz/dartz.dart' hide State;
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/shared_widgets/arrow_back_widget.dart';
import 'package:machinery/core/shared_widgets/custom_button.dart';
import 'package:machinery/core/shared_widgets/error_toast.dart';
import 'package:machinery/core/theme/styles/app_colors.dart';
import 'package:machinery/core/theme/styles/app_spacing.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_detail/maintenance_detail_cubit.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_detail/maintenance_detail_state.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/domain/repos/maintenance_repo.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart'
    show SignatureParams;
import 'package:machinery/feature/transfers/presentation/widgets/handover_signature_card.dart';

/// Send (`OPEN` → `IN_PROGRESS`) and receive (`IN_PROGRESS` → `RETURNED`)
/// share this screen — both are a real hand-off with the same signature
/// evidence a transfer needs (`11.1`). Pushed with the detail screen's own
/// `MaintenanceDetailCubit` (see `AppRoute.goToMaintenanceHandover`), so a
/// successful submit updates the record the caller is already looking at
/// without a second round trip.
class MaintenanceHandoverScreen extends StatefulWidget {
  const MaintenanceHandoverScreen({required this.isSend, super.key});

  final bool isSend;

  @override
  State<MaintenanceHandoverScreen> createState() =>
      _MaintenanceHandoverScreenState();
}

class _MaintenanceHandoverScreenState
    extends State<MaintenanceHandoverScreen> {
  final HandoverSignatureController _signature = HandoverSignatureController();

  @override
  void dispose() {
    _signature.dispose();
    super.dispose();
  }

  /// Acts on the cubit's own returned result rather than its `lastOutcome`
  /// side-channel — this screen and the detail screen underneath it share one
  /// cubit instance (see the class doc comment), so both `BlocConsumer`s react
  /// to the same emit and whichever listener runs first would null the
  /// side-channel out from under the other one.
  void _handleResult(Either<ServerFailure, MaintenanceOrderEntity> result) {
    if (!mounted) return;

    result.fold(
      (ServerFailure failure) => showErrorToast(failure.errorMessage, context),
      (MaintenanceOrderEntity _) => Navigator.of(context).pop(true),
    );
  }

  Future<void> _submit() async {
    final MaintenanceDetailCubit cubit = context.read<MaintenanceDetailCubit>();

    if (_signature.method == SignatureMethod.biometric) {
      if (!_signature.isBiometricVerified) {
        showErrorToast(LocaleKeys.signatureBiometricRequired.tr(), context);
        return;
      }

      final MaintenanceHandoverParams params = MaintenanceHandoverParams(
        signature: SignatureParams(
          method: SignatureMethod.biometric,
          deviceId: _signature.verifiedDeviceId,
          deviceModel: _signature.verifiedDeviceModel,
        ),
      );

      _handleResult(
        await (widget.isSend ? cubit.send(params) : cubit.receive(params)),
      );
      return;
    }

    final Uint8List? png = await _signature.drawn.toPngBytes();

    if (!mounted) return;

    if (png == null) {
      showErrorToast(LocaleKeys.transferSignatureRequired.tr(), context);
      return;
    }

    final Either<ServerFailure, String> upload = await getIt<MaintenanceRepo>()
        .uploadSignature(png: png);

    if (!mounted) return;

    final String? mediaId = upload.fold((ServerFailure failure) {
      showErrorToast(failure.errorMessage, context);
      return null;
    }, (String id) => id);

    if (mediaId == null) return;

    final MaintenanceHandoverParams params = MaintenanceHandoverParams(
      signature: SignatureParams(
        method: SignatureMethod.drawn,
        signatureMediaId: mediaId,
      ),
    );

    _handleResult(
      await (widget.isSend ? cubit.send(params) : cubit.receive(params)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const ArrowBackWidget(),
        title: Text(
          widget.isSend
              ? LocaleKeys.maintenanceSendTitle.tr()
              : LocaleKeys.maintenanceReceiveTitle.tr(),
        ),
      ),
      body: BlocBuilder<MaintenanceDetailCubit, MaintenanceDetailState>(
        builder: (BuildContext context, MaintenanceDetailState state) {
          final bool isBusy =
              state is MaintenanceDetailLoaded && state.actionInProgress;

          return Column(
            children: <Widget>[
              Expanded(
                child: ListView(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                  children: <Widget>[
                    HandoverSignatureCard(
                      controller: _signature,
                      reason: widget.isSend
                          ? LocaleKeys.signatureBiometricReasonSend.tr()
                          : LocaleKeys.signatureBiometricReasonReceive.tr(),
                    ),
                  ],
                ),
              ),
              SafeArea(
                child: Container(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                  decoration: const BoxDecoration(
                    color: AppColors.surfaceColor,
                    border: Border(top: BorderSide(color: AppColors.borderColor)),
                  ),
                  child: CustomButton(
                    title: LocaleKeys.transferSubmitSignature.tr(),
                    isLoading: isBusy,
                    height: 48,
                    width: double.infinity,
                    identifier: 'maintenance_handover_submit',
                    onPressed: isBusy ? null : _submit,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
