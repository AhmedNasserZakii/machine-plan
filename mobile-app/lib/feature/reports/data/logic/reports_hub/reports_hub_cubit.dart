import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/feature/reports/domain/entities/report_entities.dart';
import 'package:machinery/feature/reports/domain/repos/reports_repo.dart';

sealed class ReportsHubState extends Equatable {
  const ReportsHubState();
  @override
  List<Object?> get props => const <Object?>[];
}

class ReportsHubLoading extends ReportsHubState {
  const ReportsHubLoading();
}

class ReportsHubFailure extends ReportsHubState {
  const ReportsHubFailure(this.message);
  final String message;
  @override
  List<Object?> get props => <Object?>[message];
}

class ReportsHubLoaded extends ReportsHubState {
  const ReportsHubLoaded(this.reports);
  final List<ReportDefinition> reports;
  @override
  List<Object?> get props => <Object?>[reports];
}

class ReportsHubCubit extends Cubit<ReportsHubState> {
  ReportsHubCubit({required this.repo}) : super(const ReportsHubLoading());
  final ReportsRepo repo;
  Future<void> load() async {
    emit(const ReportsHubLoading());
    await repo.loadDownloadedExports();
    final result = await repo.catalogue();
    if (isClosed) return;
    result.fold(
      (f) => emit(ReportsHubFailure(f.errorMessage)),
      (rows) => emit(ReportsHubLoaded(rows)),
    );
  }
}
