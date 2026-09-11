import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/services/finance_change_notifier.dart';
import 'package:machinery/feature/violations/data/logic/violation_detail/violation_detail_state.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/params/violation_action_params.dart';
import 'package:machinery/feature/violations/domain/repos/violations_repo.dart';

/// What a finished action wants to tell the screen, so the cubit stays free of
/// `BuildContext` and the screen owns every toast and pop.
enum ViolationActionOutcome { acknowledged, charged, waived, edited }

class ViolationDetailCubit extends Cubit<ViolationDetailState> {
  /// [initial] is the row the list already has, so the screen opens with the
  /// type and severity filled in while the full record loads.
  ViolationDetailCubit({
    required this.violationsRepo,
    required this.violationId,
    required this.financeChangeNotifier,
    ViolationEntity? initial,
  }) : super(
         initial == null
             ? const ViolationDetailLoading()
             : ViolationDetailLoaded(violation: initial),
       );

  final ViolationsRepo violationsRepo;
  final String violationId;
  final FinanceChangeNotifier financeChangeNotifier;

  /// Set by an action so the screen can react once and clear it. Kept off the
  /// state because a rebuild must not re-fire a toast.
  ViolationActionOutcome? lastOutcome;
  String? lastError;

  Future<void> load() async {
    final ViolationDetailState previous = state;

    final result = await violationsRepo.fetchViolation(id: violationId);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) {
        // A refresh that fails over a record already on screen should leave it
        // there: stale detail beats an error page the user cannot act on.
        if (previous is ViolationDetailLoaded) {
          return;
        }

        emit(
          ViolationDetailFailure(
            errorMessage: failure.errorMessage,
            isOffline: failure is OfflineFailure,
          ),
        );
      },
      (ViolationEntity violation) =>
          emit(ViolationDetailLoaded(violation: violation)),
    );
  }

  Future<void> acknowledge() {
    return _act(
      ViolationActionOutcome.acknowledged,
      () => violationsRepo.acknowledge(id: violationId),
    );
  }

  Future<void> charge(ChargeViolationParams params) {
    return _act(
      ViolationActionOutcome.charged,
      () => violationsRepo.charge(id: violationId, params: params),
    );
  }

  Future<void> waive(WaiveViolationParams params) {
    return _act(
      ViolationActionOutcome.waived,
      () => violationsRepo.waive(id: violationId, params: params),
    );
  }

  /// Correcting the severity or description on a still-open, hand-raised
  /// record. Refused server-side on an auto-generated row — `violation.
  /// isEditable` already keeps the button off the screen for one.
  Future<void> edit(UpdateViolationParams params) {
    return _act(
      ViolationActionOutcome.edited,
      () => violationsRepo.updateViolation(id: violationId, params: params),
    );
  }

  /// Every action runs the same way: guard against a double tap, run, then take
  /// the row the server answers with — it already carries the new status, the
  /// timestamps and the amount, so there is nothing to re-fetch.
  Future<void> _act(
    ViolationActionOutcome outcome,
    Future<Either<ServerFailure, ViolationEntity>> Function() run,
  ) async {
    final ViolationDetailState current = state;
    if (current is! ViolationDetailLoaded || current.actionInProgress) {
      return;
    }

    lastOutcome = null;
    lastError = null;
    emit(current.copyWith(actionInProgress: true));

    final Either<ServerFailure, ViolationEntity> result = await run();

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) {
        lastError = failure.errorMessage;
        emit(current.copyWith(actionInProgress: false));
      },
      (ViolationEntity updated) {
        lastOutcome = outcome;
        emit(
          ViolationDetailLoaded(violation: updated, actionInProgress: false),
        );
        // A charge posts a finance transaction, which the Finance tab and
        // home dashboard have no other way to hear about while this screen
        // lives in a different tab's navigation stack.
        if (outcome == ViolationActionOutcome.charged) {
          financeChangeNotifier.notify();
        }
      },
    );
  }
}
