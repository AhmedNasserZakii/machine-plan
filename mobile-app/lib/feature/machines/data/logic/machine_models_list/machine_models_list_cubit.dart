import 'dart:async';

import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/machines/data/logic/machine_models_list/machine_models_list_state.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/domain/repos/machines_repo.dart';

/// Admin catalogue of machine models. Reads include inactive rows and both
/// locale names so the edit form can open without a second fetch.
class MachineModelsListCubit extends Cubit<MachineModelsListState> {
  MachineModelsListCubit({required this.machinesRepo})
    : super(const MachineModelsListLoading());

  final MachinesRepo machinesRepo;

  static const Duration searchDebounce = Duration(milliseconds: 250);

  Timer? _searchTimer;

  @override
  Future<void> close() {
    _searchTimer?.cancel();
    return super.close();
  }

  Future<void> load({bool showLoader = true}) async {
    if (isClosed) {
      return;
    }

    final String search = switch (state) {
      MachineModelsListLoaded(:final String search) => search,
      _ => '',
    };

    if (showLoader) {
      emit(const MachineModelsListLoading());
    }

    final Either<ServerFailure, List<MachineModelEntity>> result =
        await machinesRepo.fetchMachineModels(
          includeInactive: true,
          rawTranslations: true,
        );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) => emit(
        MachineModelsListFailure(
          errorMessage: failure.errorMessage,
          isOffline: failure is OfflineFailure,
        ),
      ),
      (List<MachineModelEntity> models) => emit(
        MachineModelsListLoaded(models: models, search: search),
      ),
    );
  }

  void search(String query) {
    _searchTimer?.cancel();
    _searchTimer = Timer(searchDebounce, () {
      final MachineModelsListState current = state;
      if (current is! MachineModelsListLoaded || isClosed) {
        return;
      }

      emit(current.copyWith(search: query));
    });
  }
}
