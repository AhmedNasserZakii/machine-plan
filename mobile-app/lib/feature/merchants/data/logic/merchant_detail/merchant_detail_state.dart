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
    this.machinesHasNext = false,
    this.machinesPage = 1,
    this.isLoadingMoreMachines = false,
    this.subscriptionsHasNext = false,
    this.subscriptionsPage = 1,
    this.isLoadingMoreSubscriptions = false,
    this.timelineHasNext = false,
    this.timelineCursor,
    this.isLoadingMoreTimeline = false,
  });

  final MerchantDetail detail;

  /// The machines, plans and timeline arrive after the record itself, so the
  /// three cards below the header show their own spinner rather than holding
  /// the whole screen back.
  final bool isLoadingRelated;

  /// Blocks a second tap on collect or deactivate while the first is in flight.
  final bool actionInProgress;

  final bool machinesHasNext;
  final int machinesPage;
  final bool isLoadingMoreMachines;

  final bool subscriptionsHasNext;
  final int subscriptionsPage;
  final bool isLoadingMoreSubscriptions;

  final bool timelineHasNext;
  final String? timelineCursor;
  final bool isLoadingMoreTimeline;

  MerchantDetailLoaded copyWith({
    MerchantDetail? detail,
    bool? isLoadingRelated,
    bool? actionInProgress,
    bool? machinesHasNext,
    int? machinesPage,
    bool? isLoadingMoreMachines,
    bool? subscriptionsHasNext,
    int? subscriptionsPage,
    bool? isLoadingMoreSubscriptions,
    bool? timelineHasNext,
    String? timelineCursor,
    bool clearTimelineCursor = false,
    bool? isLoadingMoreTimeline,
  }) {
    return MerchantDetailLoaded(
      detail: detail ?? this.detail,
      isLoadingRelated: isLoadingRelated ?? this.isLoadingRelated,
      actionInProgress: actionInProgress ?? this.actionInProgress,
      machinesHasNext: machinesHasNext ?? this.machinesHasNext,
      machinesPage: machinesPage ?? this.machinesPage,
      isLoadingMoreMachines:
          isLoadingMoreMachines ?? this.isLoadingMoreMachines,
      subscriptionsHasNext: subscriptionsHasNext ?? this.subscriptionsHasNext,
      subscriptionsPage: subscriptionsPage ?? this.subscriptionsPage,
      isLoadingMoreSubscriptions:
          isLoadingMoreSubscriptions ?? this.isLoadingMoreSubscriptions,
      timelineHasNext: timelineHasNext ?? this.timelineHasNext,
      timelineCursor: clearTimelineCursor
          ? timelineCursor
          : (timelineCursor ?? this.timelineCursor),
      isLoadingMoreTimeline:
          isLoadingMoreTimeline ?? this.isLoadingMoreTimeline,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    detail,
    isLoadingRelated,
    actionInProgress,
    machinesHasNext,
    machinesPage,
    isLoadingMoreMachines,
    subscriptionsHasNext,
    subscriptionsPage,
    isLoadingMoreSubscriptions,
    timelineHasNext,
    timelineCursor,
    isLoadingMoreTimeline,
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
