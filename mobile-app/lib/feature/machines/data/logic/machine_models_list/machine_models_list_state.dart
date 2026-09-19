import 'package:equatable/equatable.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';

sealed class MachineModelsListState extends Equatable {
  const MachineModelsListState();

  @override
  List<Object?> get props => <Object?>[];
}

class MachineModelsListLoading extends MachineModelsListState {
  const MachineModelsListLoading();
}

class MachineModelsListLoaded extends MachineModelsListState {
  const MachineModelsListLoaded({
    required this.models,
    this.search = '',
  });

  final List<MachineModelEntity> models;
  final String search;

  List<MachineModelEntity> get visible {
    final String query = search.trim().toLowerCase();
    if (query.isEmpty) {
      return models;
    }

    return models
        .where((MachineModelEntity model) {
          return model.name.toLowerCase().contains(query) ||
              model.code.toLowerCase().contains(query) ||
              (model.manufacturer?.toLowerCase().contains(query) ?? false) ||
              model.type.name.toLowerCase().contains(query) ||
              (model.nameAr?.toLowerCase().contains(query) ?? false) ||
              (model.nameEn?.toLowerCase().contains(query) ?? false);
        })
        .toList(growable: false);
  }

  MachineModelsListLoaded copyWith({
    List<MachineModelEntity>? models,
    String? search,
  }) {
    return MachineModelsListLoaded(
      models: models ?? this.models,
      search: search ?? this.search,
    );
  }

  @override
  List<Object?> get props => <Object?>[models, search];
}

class MachineModelsListFailure extends MachineModelsListState {
  const MachineModelsListFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
