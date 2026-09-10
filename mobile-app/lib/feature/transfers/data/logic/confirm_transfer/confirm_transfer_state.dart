import 'package:equatable/equatable.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';

class ConfirmTransferState extends Equatable {
  const ConfirmTransferState({
    required this.transfer,
    this.adjustments = const <String, ItemAdjustmentParams>{},
    this.isSubmitting = false,
    this.errorMessage,
    this.payloadChanged = false,
    this.confirmed,
  });

  final TransferEntity transfer;

  /// Keyed by transfer item id. Only rows the receiver actually disagreed with
  /// appear here; everything else stands as the sender declared it.
  final Map<String, ItemAdjustmentParams> adjustments;

  final bool isSubmitting;
  final String? errorMessage;

  /// The server refused the signature because the document changed after this
  /// screen loaded. The user has to re-read before signing again — a signature
  /// is never auto-retried, because the whole point is that a person signed for
  /// a specific set of facts.
  final bool payloadChanged;

  /// Set once the hand-off is accepted; the screen pops with this.
  final TransferEntity? confirmed;

  /// How many rows differ from the sender's declaration, which is the number the
  /// review summary leads with.
  int get adjustedCount =>
      adjustments.values.where((ItemAdjustmentParams a) => !a.isEmpty).length;

  bool _effectiveHasCharger(TransferItemEntity item) =>
      adjustments[item.id]?.hasCharger ?? item.hasCharger;

  /// Recomputed against what the receiver is about to sign for, not what the
  /// sender originally declared — a charger an adjustment restored no longer
  /// counts as missing, and one an adjustment just discovered gone now does.
  int get missingChargerCount =>
      transfer.items.where((TransferItemEntity item) => !_effectiveHasCharger(item)).length;

  /// A row counts as still mismatched only when nobody touched its battery
  /// serial. The device has no way to re-verify a receiver's correction
  /// against the machine's actual bonded battery — that check happened once,
  /// server-side, against the sender's original scan — so a corrected row is
  /// dropped from the tally rather than re-guessed at.
  int get mismatchCount => transfer.items.where((TransferItemEntity item) {
    final ItemAdjustmentParams? adjustment = adjustments[item.id];
    if (adjustment?.batterySerialScanned != null) return false;
    return item.batteryMatches == false;
  }).length;

  ConfirmTransferState copyWith({
    TransferEntity? transfer,
    Map<String, ItemAdjustmentParams>? adjustments,
    bool? isSubmitting,
    String? errorMessage,
    bool? payloadChanged,
    TransferEntity? confirmed,
    bool clearError = false,
  }) {
    return ConfirmTransferState(
      transfer: transfer ?? this.transfer,
      adjustments: adjustments ?? this.adjustments,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      payloadChanged: payloadChanged ?? this.payloadChanged,
      confirmed: confirmed ?? this.confirmed,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    transfer,
    adjustments,
    isSubmitting,
    errorMessage,
    payloadChanged,
    confirmed,
  ];
}
