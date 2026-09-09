import 'package:equatable/equatable.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';

sealed class TransferDetailState extends Equatable {
  const TransferDetailState();

  @override
  List<Object?> get props => <Object?>[];
}

class TransferDetailLoading extends TransferDetailState {
  const TransferDetailLoading();
}

class TransferDetailLoaded extends TransferDetailState {
  const TransferDetailLoaded({
    required this.transfer,
    this.isActing = false,
    this.actionMessage,
    this.actionError,
  });

  final TransferEntity transfer;

  /// A confirm, reject or cancel in flight. Blocks the action bar so a signature
  /// cannot be submitted twice.
  final bool isActing;

  /// One-shot lines for the screen to surface as a toast and then clear. Kept
  /// apart so a failed reject cannot be rendered as a green success bar.
  final String? actionMessage;
  final String? actionError;

  TransferDetailLoaded copyWith({
    TransferEntity? transfer,
    bool? isActing,
    String? actionMessage,
    String? actionError,
    bool clearMessages = false,
  }) {
    return TransferDetailLoaded(
      transfer: transfer ?? this.transfer,
      isActing: isActing ?? this.isActing,
      actionMessage: clearMessages
          ? null
          : (actionMessage ?? this.actionMessage),
      actionError: clearMessages ? null : (actionError ?? this.actionError),
    );
  }

  @override
  List<Object?> get props => <Object?>[
    transfer,
    isActing,
    actionMessage,
    actionError,
  ];
}

class TransferDetailFailure extends TransferDetailState {
  const TransferDetailFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
