import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_detail/maintenance_detail_state.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/domain/repos/maintenance_repo.dart';

/// What a finished action wants to tell the screen, so the cubit stays free of
/// `BuildContext` and the screen owns every toast and pop.
enum MaintenanceActionOutcome { sent, received, cancelled, closed, updated }

class MaintenanceDetailCubit extends Cubit<MaintenanceDetailState> {
  /// [initial] is the row the list already has, so the screen opens with the
  /// status and location filled in while the full record loads.
  MaintenanceDetailCubit({
    required this.maintenanceRepo,
    required this.orderId,
    MaintenanceOrderEntity? initial,
  }) : super(
         initial == null
             ? const MaintenanceDetailLoading()
             : MaintenanceDetailLoaded(order: initial),
       );

  final MaintenanceRepo maintenanceRepo;
  final String orderId;

  MaintenanceActionOutcome? lastOutcome;
  String? lastError;

  Future<void> load() async {
    final MaintenanceDetailState previous = state;

    final result = await maintenanceRepo.fetchOrder(id: orderId);

    if (isClosed) return;

    result.fold(
      (ServerFailure failure) {
        // A refresh that fails over a record already on screen should leave it
        // there: stale detail beats an error page the user cannot act on.
        if (previous is MaintenanceDetailLoaded) return;

        emit(
          MaintenanceDetailFailure(
            errorMessage: failure.errorMessage,
            isOffline: failure is OfflineFailure,
          ),
        );
      },
      (MaintenanceOrderEntity order) =>
          emit(MaintenanceDetailLoaded(order: order)),
    );
  }

  Future<Either<ServerFailure, MaintenanceOrderEntity>> update(
    UpdateMaintenanceOrderParams params,
  ) {
    return _act(
      MaintenanceActionOutcome.updated,
      () => maintenanceRepo.updateOrder(id: orderId, params: params),
    );
  }

  Future<Either<ServerFailure, MaintenanceOrderEntity>> send(
    MaintenanceHandoverParams params,
  ) {
    return _act(
      MaintenanceActionOutcome.sent,
      () => maintenanceRepo.sendOrder(id: orderId, params: params),
    );
  }

  Future<Either<ServerFailure, MaintenanceOrderEntity>> receive(
    MaintenanceHandoverParams params,
  ) {
    return _act(
      MaintenanceActionOutcome.received,
      () => maintenanceRepo.receiveOrder(id: orderId, params: params),
    );
  }

  Future<Either<ServerFailure, MaintenanceOrderEntity>> cancel(
    CancelMaintenanceOrderParams params,
  ) {
    return _act(
      MaintenanceActionOutcome.cancelled,
      () => maintenanceRepo.cancelOrder(id: orderId, params: params),
    );
  }

  Future<Either<ServerFailure, MaintenanceOrderEntity>> closeOrder(
    CloseMaintenanceOrderParams params,
  ) {
    return _act(
      MaintenanceActionOutcome.closed,
      () => maintenanceRepo.closeOrder(id: orderId, params: params),
    );
  }

  /// Every action runs the same way: guard against a double tap, run, then take
  /// the row the server answers with — it already carries the new status and
  /// every field the close/send/receive touched, so there is nothing to
  /// re-fetch.
  ///
  /// Returns the raw result too, not just `lastOutcome`/`lastError`: the
  /// handover screen shares this exact cubit instance with the detail screen
  /// underneath it (`AppRoute.goToMaintenanceHandover`), so both screens'
  /// `BlocConsumer`s react to the same emit — whichever listener runs first
  /// would otherwise null the fields out from under the other one.
  Future<Either<ServerFailure, MaintenanceOrderEntity>> _act(
    MaintenanceActionOutcome outcome,
    Future<Either<ServerFailure, MaintenanceOrderEntity>> Function() run,
  ) async {
    final MaintenanceDetailState current = state;
    if (current is! MaintenanceDetailLoaded || current.actionInProgress) {
      return Left(ServerFailure(''));
    }

    lastOutcome = null;
    lastError = null;
    emit(current.copyWith(actionInProgress: true));

    final Either<ServerFailure, MaintenanceOrderEntity> result = await run();

    if (isClosed) return result;

    result.fold(
      (ServerFailure failure) {
        lastError = failure.errorMessage;
        emit(current.copyWith(actionInProgress: false));
      },
      (MaintenanceOrderEntity updated) {
        lastOutcome = outcome;
        emit(MaintenanceDetailLoaded(order: updated, actionInProgress: false));
      },
    );

    return result;
  }
}
