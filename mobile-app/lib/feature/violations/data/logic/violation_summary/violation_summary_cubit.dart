import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/violations/domain/entities/violation_entity.dart';
import 'package:machinery/feature/violations/domain/repos/violations_repo.dart';

sealed class ViolationSummaryState extends Equatable {
  const ViolationSummaryState();

  @override
  List<Object?> get props => <Object?>[];
}

class ViolationSummaryLoading extends ViolationSummaryState {
  const ViolationSummaryLoading();
}

class ViolationSummaryLoaded extends ViolationSummaryState {
  const ViolationSummaryLoaded({required this.summary});

  final ViolationSummary summary;

  @override
  List<Object?> get props => <Object?>[summary];
}

class ViolationSummaryFailure extends ViolationSummaryState {
  const ViolationSummaryFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}

/// Backs the one screen a Director opens before deciding anything about a
/// representative. Read-only: there is nothing to act on here, only to see.
class ViolationSummaryCubit extends Cubit<ViolationSummaryState> {
  ViolationSummaryCubit({required this.violationsRepo, required this.userId})
    : super(const ViolationSummaryLoading());

  final ViolationsRepo violationsRepo;
  final String userId;

  Future<void> load() async {
    final result = await violationsRepo.fetchSummary(userId: userId);

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        ViolationSummaryFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (ViolationSummary summary) =>
          emit(ViolationSummaryLoaded(summary: summary)),
    );
  }
}
