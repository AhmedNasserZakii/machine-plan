import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_detail/merchant_detail_state.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/domain/params/merchant_form_params.dart';
import 'package:machinery/feature/merchants/domain/repos/merchants_repo.dart';

/// What a finished action wants to tell the screen, so the cubit stays free of
/// `BuildContext` and the screen owns every toast and pop.
enum MerchantActionOutcome { collected, subscribed, deactivated }

class MerchantDetailCubit extends Cubit<MerchantDetailState> {
  /// [initial] is the row the list already has. Showing it immediately means
  /// the screen opens with the shop name and phone filled in while the full
  /// record loads, instead of a spinner over information the app already holds.
  MerchantDetailCubit({
    required this.merchantsRepo,
    required this.merchantId,
    MerchantEntity? initial,
  }) : super(
         initial == null
             ? const MerchantDetailLoading()
             : MerchantDetailLoaded(
                 detail: MerchantDetail(merchant: initial),
                 isLoadingRelated: true,
               ),
       );

  final MerchantsRepo merchantsRepo;
  final String merchantId;

  /// Set by an action so the screen can react once and clear it. Kept off the
  /// state because a rebuild must not re-fire a toast.
  MerchantActionOutcome? lastOutcome;
  String? lastError;

  Future<void> load() async {
    final MerchantDetailState previous = state;

    final result = await merchantsRepo.fetchMerchant(id: merchantId);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) {
        // A refresh that fails over a record already on screen should leave it
        // there: stale detail beats an error page the user cannot act on.
        if (previous is MerchantDetailLoaded) {
          emit(previous.copyWith(isLoadingRelated: false));
          return;
        }

        emit(
          MerchantDetailFailure(
            errorMessage: failure.errorMessage,
            isOffline: failure is OfflineFailure,
          ),
        );
      },
      (MerchantEntity merchant) {
        final MerchantDetailState current = state;
        final MerchantDetail base = current is MerchantDetailLoaded
            ? current.detail.copyWith(merchant: merchant)
            : MerchantDetail(merchant: merchant);

        emit(MerchantDetailLoaded(detail: base, isLoadingRelated: true));
        _loadRelated();
      },
    );
  }

  /// Called after the form saves, so the detail reflects the edit without a
  /// round trip.
  void applyUpdate(MerchantEntity updated) {
    final MerchantDetailState current = state;

    emit(
      current is MerchantDetailLoaded
          ? current.copyWith(detail: current.detail.copyWith(merchant: updated))
          : MerchantDetailLoaded(detail: MerchantDetail(merchant: updated)),
    );
  }

  Future<void> createSubscription(CreateSubscriptionParams params) {
    return _act(
      MerchantActionOutcome.subscribed,
      () => merchantsRepo.createSubscription(
        merchantId: merchantId,
        params: params,
      ),
    );
  }

  Future<void> collect(
    String subscriptionId,
    CollectSubscriptionParams params,
  ) {
    return _act(
      MerchantActionOutcome.collected,
      () => merchantsRepo.collectSubscription(
        subscriptionId: subscriptionId,
        params: params,
      ),
    );
  }

  Future<void> deactivate({String? reason}) {
    return _act(
      MerchantActionOutcome.deactivated,
      () => merchantsRepo.deactivateMerchant(id: merchantId, reason: reason),
    );
  }

  Future<void> loadMoreMachines() async {
    final MerchantDetailState current = state;
    if (current is! MerchantDetailLoaded ||
        current.isLoadingMoreMachines ||
        !current.machinesHasNext) {
      return;
    }

    emit(current.copyWith(isLoadingMoreMachines: true));

    final result = await merchantsRepo.fetchMerchantMachines(
      id: merchantId,
      page: current.machinesPage + 1,
    );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure _) =>
          emit(current.copyWith(isLoadingMoreMachines: false)),
      (MerchantMachinesPage page) {
        final MerchantDetailState latest = state;
        if (latest is! MerchantDetailLoaded) {
          return;
        }
        emit(
          latest.copyWith(
            detail: latest.detail.copyWith(
              machines: <MachineEntity>[
                ...latest.detail.machines,
                ...page.machines,
              ],
            ),
            machinesPage: current.machinesPage + 1,
            machinesHasNext: page.meta.hasNext,
            isLoadingMoreMachines: false,
          ),
        );
      },
    );
  }

  Future<void> loadMoreSubscriptions() async {
    final MerchantDetailState current = state;
    if (current is! MerchantDetailLoaded ||
        current.isLoadingMoreSubscriptions ||
        !current.subscriptionsHasNext) {
      return;
    }

    emit(current.copyWith(isLoadingMoreSubscriptions: true));

    final result = await merchantsRepo.fetchSubscriptions(
      id: merchantId,
      page: current.subscriptionsPage + 1,
    );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure _) =>
          emit(current.copyWith(isLoadingMoreSubscriptions: false)),
      (MerchantSubscriptionsPage page) {
        final MerchantDetailState latest = state;
        if (latest is! MerchantDetailLoaded) {
          return;
        }
        emit(
          latest.copyWith(
            detail: latest.detail.copyWith(
              subscriptions: <SubscriptionEntity>[
                ...latest.detail.subscriptions,
                ...page.subscriptions,
              ],
            ),
            subscriptionsPage: current.subscriptionsPage + 1,
            subscriptionsHasNext: page.meta.hasNext,
            isLoadingMoreSubscriptions: false,
          ),
        );
      },
    );
  }

  Future<void> loadMoreTimeline() async {
    final MerchantDetailState current = state;
    if (current is! MerchantDetailLoaded ||
        current.isLoadingMoreTimeline ||
        !current.timelineHasNext) {
      return;
    }

    emit(current.copyWith(isLoadingMoreTimeline: true));

    final result = await merchantsRepo.fetchTimeline(
      id: merchantId,
      cursor: current.timelineCursor,
    );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure _) =>
          emit(current.copyWith(isLoadingMoreTimeline: false)),
      (MerchantTimelinePage page) {
        final MerchantDetailState latest = state;
        if (latest is! MerchantDetailLoaded) {
          return;
        }
        emit(
          latest.copyWith(
            detail: latest.detail.copyWith(
              timeline: <MerchantTimelineEntry>[
                ...latest.detail.timeline,
                ...page.entries,
              ],
            ),
            timelineHasNext: page.meta.hasNext,
            timelineCursor: page.meta.nextCursor,
            clearTimelineCursor: true,
            isLoadingMoreTimeline: false,
          ),
        );
      },
    );
  }

  Future<void> loadRemainingMachines() async {
    int safety = 0;
    while (safety < 10) {
      final MerchantDetailState current = state;
      if (current is! MerchantDetailLoaded || !current.machinesHasNext) {
        return;
      }
      await loadMoreMachines();
      safety++;
    }
  }

  /// Every action runs the same way: guard against a double tap, run, then
  /// reload so the totals, the next due date and the timeline all agree with
  /// what the server now holds. Related lists reload from page 1.
  Future<void> _act<T>(
    MerchantActionOutcome outcome,
    Future<Either<ServerFailure, T>> Function() run,
  ) async {
    final MerchantDetailState current = state;
    if (current is! MerchantDetailLoaded || current.actionInProgress) {
      return;
    }

    lastOutcome = null;
    lastError = null;
    emit(current.copyWith(actionInProgress: true));

    final Either<ServerFailure, T> result = await run();

    if (isClosed) {
      return;
    }

    result.fold((ServerFailure failure) => lastError = failure.errorMessage, (
      _,
    ) {
      lastOutcome = outcome;
    });

    final MerchantDetailState settled = state;
    if (settled is MerchantDetailLoaded) {
      emit(settled.copyWith(actionInProgress: false));
    }

    if (lastOutcome != null) {
      await load();
    }
  }

  Future<void> _loadRelated() async {
    final (
      Either<ServerFailure, MerchantMachinesPage> machines,
      Either<ServerFailure, MerchantSubscriptionsPage> subscriptions,
      Either<ServerFailure, MerchantTimelinePage> timeline,
    ) = await (
      merchantsRepo.fetchMerchantMachines(id: merchantId),
      merchantsRepo.fetchSubscriptions(id: merchantId),
      merchantsRepo.fetchTimeline(id: merchantId),
    ).wait;

    if (isClosed) {
      return;
    }

    final MerchantDetailState current = state;
    if (current is! MerchantDetailLoaded) {
      return;
    }

    final MerchantMachinesPage? machinesPage = machines.toOption().toNullable();
    final MerchantSubscriptionsPage? subscriptionsPage =
        subscriptions.toOption().toNullable();
    final MerchantTimelinePage? timelinePage = timeline.toOption().toNullable();

    // These three are supporting detail, not the point of the screen: one that
    // fails simply leaves its card empty.
    emit(
      current.copyWith(
        detail: current.detail.copyWith(
          machines: machinesPage?.machines ?? current.detail.machines,
          subscriptions:
              subscriptionsPage?.subscriptions ?? current.detail.subscriptions,
          timeline: timelinePage?.entries ?? current.detail.timeline,
        ),
        machinesHasNext: machinesPage?.meta.hasNext ?? false,
        machinesPage: 1,
        isLoadingMoreMachines: false,
        subscriptionsHasNext: subscriptionsPage?.meta.hasNext ?? false,
        subscriptionsPage: 1,
        isLoadingMoreSubscriptions: false,
        timelineHasNext: timelinePage?.meta.hasNext ?? false,
        timelineCursor: timelinePage?.meta.nextCursor,
        clearTimelineCursor: true,
        isLoadingMoreTimeline: false,
        isLoadingRelated: false,
      ),
    );
  }
}
