import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';

/// `GET /machine-types`. Names arrive already resolved for the request locale,
/// so there is nothing to translate on this side.
class MachineTypeModel {
  const MachineTypeModel({required this.entity});

  final MachineTypeEntity entity;

  factory MachineTypeModel.fromJson(Map<String, dynamic> json) {
    return MachineTypeModel(
      entity: MachineTypeEntity(
        id: json[ApiKeys.id]?.toString() ?? '',
        code: json[ApiKeys.code] as String? ?? '',
        name: json[ApiKeys.name] as String? ?? '',
        requiresSim: json[ApiKeys.requiresSim] as bool? ?? true,
      ),
    );
  }

  MachineTypeEntity toEntity() => entity;
}

/// `GET /machine-models`. The parent type comes nested, which is what lets the
/// intake form show or hide the SIM field the moment a model is picked, without
/// a second round trip.
class MachineModelModel {
  const MachineModelModel({required this.entity});

  final MachineModelEntity entity;

  factory MachineModelModel.fromJson(Map<String, dynamic> json) {
    final dynamic rawType = json[ApiKeys.machineType];
    final Map<String, dynamic> type = rawType is Map<String, dynamic>
        ? rawType
        : const <String, dynamic>{};

    final ({String? ar, String? en}) names = _localeNames(json);

    return MachineModelModel(
      entity: MachineModelEntity(
        id: json[ApiKeys.id]?.toString() ?? '',
        code: json[ApiKeys.code] as String? ?? '',
        name: json[ApiKeys.name] as String? ?? '',
        manufacturer: json[ApiKeys.manufacturer] as String?,
        isActive: json[ApiKeys.isActive] as bool? ?? true,
        nameAr: names.ar,
        nameEn: names.en,
        type: MachineTypeModel.fromJson(type).toEntity(),
      ),
    );
  }

  MachineModelEntity toEntity() => entity;

  /// Admin lists ask for `rawTranslations`; ordinary pickers only get [name].
  static ({String? ar, String? en}) _localeNames(Map<String, dynamic> json) {
    final dynamic raw = json[ApiKeys.translations];
    if (raw is! Map<String, dynamic>) {
      return (ar: null, en: null);
    }

    return (
      ar: _localeName(raw[ApiKeys.ar]),
      en: _localeName(raw[ApiKeys.en]),
    );
  }

  static String? _localeName(dynamic raw) {
    if (raw is! Map<String, dynamic>) {
      return null;
    }
    final String? name = raw[ApiKeys.name] as String?;
    return name?.trim().isEmpty ?? true ? null : name;
  }
}
