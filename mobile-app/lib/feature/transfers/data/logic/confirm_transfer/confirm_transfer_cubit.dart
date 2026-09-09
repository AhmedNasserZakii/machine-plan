import 'dart:typed_data';

import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/data/logic/confirm_transfer/confirm_transfer_state.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo.dart';

/// The server's answer when the item list changed between the screen loading
/// and the signature being taken.
const String _payloadChangedCode = 'PAYLOAD_CHANGED';

class ConfirmTransferCubit extends Cubit<ConfirmTransferState> {
  ConfirmTransferCubit({
    required this.transfersRepo,
    required TransferEntity transfer,
  }) : super(ConfirmTransferState(transfer: transfer));

  final TransfersRepo transfersRepo;

  /// The receiver's word wins. He is the one taking custody, so a correction
  /// here overrides what the sender declared — and the mismatch it reveals is
  /// recorded rather than argued about.
  void adjust(
    String itemId, {
    bool? hasCharger,
    bool? hasBox,
    ItemCondition? condition,
    String? batterySerialScanned,
    String? notes,
  }) {
    final ItemAdjustmentParams existing =
        state.adjustments[itemId] ??
        ItemAdjustmentParams(transferItemId: itemId);

    final Map<String, ItemAdjustmentParams> next =
        Map<String, ItemAdjustmentParams>.from(state.adjustments)
          ..[itemId] = ItemAdjustmentParams(
            transferItemId: itemId,
            hasCharger: hasCharger ?? existing.hasCharger,
            hasBox: hasBox ?? existing.hasBox,
            condition: condition ?? existing.condition,
            batterySerialScanned:
                batterySerialScanned ?? existing.batterySerialScanned,
            notes: notes ?? existing.notes,
          );

    emit(state.copyWith(adjustments: next, clearError: true));
  }

  /// Puts one row back the way the sender declared it.
  void resetAdjustment(String itemId) {
    if (!state.adjustments.containsKey(itemId)) return;

    emit(
      state.copyWith(
        adjustments: Map<String, ItemAdjustmentParams>.from(state.adjustments)
          ..remove(itemId),
      ),
    );
  }

  /// Reloads after a `PAYLOAD_CHANGED`. Adjustments are dropped along with the
  /// stale document: they were made against rows that no longer say what they
  /// said.
  Future<void> reload() async {
    final result = await transfersRepo.fetchTransfer(id: state.transfer.id);

    if (isClosed) return;

    result.fold(
      (ServerFailure failure) =>
          emit(state.copyWith(errorMessage: failure.errorMessage)),
      (TransferEntity transfer) =>
          emit(ConfirmTransferState(transfer: transfer)),
    );
  }

  /// Uploads the drawn signature, then signs for the delivery. The two are one
  /// action from the user's point of view, so a failed upload must not leave the
  /// button looking ready.
  Future<void> submit({
    required Uint8List signaturePng,
    String? deviceModel,
  }) async {
    if (state.isSubmitting) return;

    emit(state.copyWith(isSubmitting: true, clearError: true));

    final Either<ServerFailure, String> upload = await transfersRepo
        .uploadSignature(png: signaturePng);

    if (isClosed) return;

    final String? mediaId = upload.fold((ServerFailure failure) {
      emit(
        state.copyWith(isSubmitting: false, errorMessage: failure.errorMessage),
      );
      return null;
    }, (String id) => id);

    if (mediaId == null) return;

    final result = await transfersRepo.confirmTransfer(
      id: state.transfer.id,
      params: ConfirmTransferParams(
        signature: SignatureParams(
          method: SignatureMethod.drawn,
          signatureMediaId: mediaId,
          deviceModel: deviceModel,
        ),
        payloadHash: state.transfer.payloadHash ?? '',
        adjustments: state.adjustments.values
            .where((ItemAdjustmentParams a) => !a.isEmpty)
            .toList(growable: false),
      ),
    );

    if (isClosed) return;

    result.fold(
      (ServerFailure failure) => emit(
        state.copyWith(
          isSubmitting: false,
          errorMessage: failure.errorMessage,
          payloadChanged: failure.code == _payloadChangedCode,
        ),
      ),
      (TransferEntity transfer) => emit(
        state.copyWith(
          isSubmitting: false,
          transfer: transfer,
          confirmed: transfer,
        ),
      ),
    );
  }
}
