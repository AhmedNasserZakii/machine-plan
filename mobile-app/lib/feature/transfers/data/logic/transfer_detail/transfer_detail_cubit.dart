import 'package:dartz/dartz.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/constants/locale_keys.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/transfers/data/logic/transfer_detail/transfer_detail_state.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo.dart';

class TransferDetailCubit extends Cubit<TransferDetailState> {
  TransferDetailCubit({
    required this.transfersRepo,
    required this.transferId,
    TransferEntity? initial,
  }) : super(
         initial == null
             ? const TransferDetailLoading()
             : TransferDetailLoaded(transfer: initial),
       );

  final TransfersRepo transfersRepo;
  final String transferId;

  Future<void> load() async {
    final TransferDetailState current = state;

    // A list row already carries enough to render the header, so a refresh
    // should not blank the screen the user is reading.
    if (current is! TransferDetailLoaded) {
      emit(const TransferDetailLoading());
    }

    final result = await transfersRepo.fetchTransfer(id: transferId);

    if (isClosed) return;

    result.fold(
      (ServerFailure failure) => emit(
        TransferDetailFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (TransferEntity transfer) =>
          emit(TransferDetailLoaded(transfer: transfer)),
    );
  }

  /// The whole delivery never physically happened. A single mismatched machine
  /// is *not* rejected — it is accepted and the mismatch recorded — so the UI
  /// keeps the two paths clearly apart.
  Future<void> reject(String reason) => _act(
    () => transfersRepo.rejectTransfer(id: transferId, reason: reason),
    LocaleKeys.transferRejected,
  );

  /// The sender withdraws before anyone signs.
  Future<void> cancel(String? reason) => _act(
    () => transfersRepo.cancelTransfer(id: transferId, reason: reason),
    LocaleKeys.transferCancelled,
  );

  /// Swaps in a transfer the confirm screen just returned, without a round trip.
  void applyResult(TransferEntity transfer, String messageKey) {
    if (isClosed) return;

    emit(
      TransferDetailLoaded(transfer: transfer, actionMessage: messageKey.tr()),
    );
  }

  void consumeMessages() {
    final TransferDetailState current = state;

    if (current is TransferDetailLoaded &&
        (current.actionMessage != null || current.actionError != null)) {
      emit(current.copyWith(clearMessages: true));
    }
  }

  Future<void> _act(
    Future<Either<ServerFailure, TransferEntity>> Function() run,
    String successKey,
  ) async {
    final TransferDetailState current = state;
    if (current is! TransferDetailLoaded || current.isActing) return;

    emit(current.copyWith(isActing: true, clearMessages: true));

    final Either<ServerFailure, TransferEntity> result = await run();

    if (isClosed) return;

    emit(
      result.fold(
        (ServerFailure failure) => current.copyWith(
          isActing: false,
          actionError: failure.errorMessage,
        ),
        (TransferEntity transfer) => TransferDetailLoaded(
          transfer: transfer,
          actionMessage: successKey.tr(),
        ),
      ),
    );
  }
}
