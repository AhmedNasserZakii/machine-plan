import 'package:equatable/equatable.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';

sealed class MerchantDetailState extends Equatable {
  const MerchantDetailState();

  @override
  List<Object?> get props => <Object?>[];
}

class MerchantDetailLoading extends MerchantDetailState {
  const MerchantDetailLoading();
}

class MerchantDetailLoaded extends MerchantDetailState {
  const MerchantDetailLoaded({
    required this.detail,
    this.isLoadingRelated = false,
    this.actionInProgress = false,
  });

  final MerchantDetail detail;

  /// The machines, plans and timeline arrive after the record itself, so the
  /// three cards below the header show their own spinner rather than holding
  /// the whole screen back.
  final bool isLoadingRelated;

  /// Blocks a second tap on collect or deactivate while the first is in flight.
  final bool actionInProgress;

  MerchantDetailLoaded copyWith({
    MerchantDetail? detail,
    bool? isLoadingRelated,
    bool? actionInProgress,
  }) {
    return MerchantDetailLoaded(
      detail: detail ?? this.detail,
      isLoadingRelated: isLoadingRelated ?? this.isLoadingRelated,
      actionInProgress: actionInProgress ?? this.actionInProgress,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    detail,
    isLoadingRelated,
    actionInProgress,
  ];
}

class MerchantDetailFailure extends MerchantDetailState {
  const MerchantDetailFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
