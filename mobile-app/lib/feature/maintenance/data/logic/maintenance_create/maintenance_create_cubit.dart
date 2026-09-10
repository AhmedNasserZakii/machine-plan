import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/di/service_locator.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/core/lookups/lookups_repo.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/maintenance/data/logic/maintenance_create/maintenance_create_state.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';
import 'package:machinery/feature/maintenance/domain/params/maintenance_params.dart';
import 'package:machinery/feature/maintenance/domain/repos/maintenance_repo.dart';

/// Opens for one machine, already known to the caller (`11.1`) — there is no
/// picker here, only the location, the fault and the date it went out.
class MaintenanceCreateCubit extends Cubit<MaintenanceCreateState> {
  MaintenanceCreateCubit({required this.maintenanceRepo})
    : super(const MaintenanceCreateLoading());

  final MaintenanceRepo maintenanceRepo;

  Future<void> load() async {
    if (isClosed) return;

    emit(const MaintenanceCreateLoading());

    final Either<ServerFailure, List<LookupEntity>> result =
        await getIt<LookupsRepo>().maintenanceLocations();

    if (isClosed) return;

    result.fold(
      (ServerFailure failure) => emit(
        MaintenanceCreateLoadFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (List<LookupEntity> locations) =>
          emit(MaintenanceCreateReady(locations: locations)),
    );
  }

  void selectLocation(String locationId) {
    final MaintenanceCreateState current = state;
    if (current is! MaintenanceCreateReady) return;

    emit(current.copyWith(locationId: locationId));
  }

  void setSentAt(String? date) {
    final MaintenanceCreateState current = state;
    if (current is! MaintenanceCreateReady) return;

    emit(
      MaintenanceCreateReady(
        locations: current.locations,
        locationId: current.locationId,
        sentAt: date,
        isSubmitting: current.isSubmitting,
      ),
    );
  }

  Future<void> submit({
    required String machineId,
    required String reportedFault,
    String? notes,
  }) async {
    final MaintenanceCreateState current = state;
    if (current is! MaintenanceCreateReady || current.isSubmitting) return;

    final String? locationId = current.locationId;
    final String? sentAt = current.sentAt;
    if (locationId == null || sentAt == null) return;

    emit(current.copyWith(isSubmitting: true));

    final Either<ServerFailure, MaintenanceOrderEntity> result =
        await maintenanceRepo.createOrder(
          params: CreateMaintenanceOrderParams(
            machineId: machineId,
            locationId: locationId,
            reportedFault: reportedFault,
            sentAt: sentAt,
            notes: notes,
          ),
        );

    if (isClosed) return;

    result.fold(
      (ServerFailure failure) {
        emit(MaintenanceCreateSubmitFailure(errorMessage: failure.errorMessage));
        emit(current.copyWith(isSubmitting: false));
      },
      (MaintenanceOrderEntity order) =>
          emit(MaintenanceCreateSubmitted(order: order)),
    );
  }
}
