import 'package:equatable/equatable.dart';

/// A machine type from `GET /machine-types`. [requiresSim] is the flag the
/// intake form reads before deciding whether to show the SIM field at all.
class MachineTypeEntity extends Equatable {
  const MachineTypeEntity({
    required this.id,
    required this.code,
    required this.name,
    required this.requiresSim,
  });

  final String id;
  final String code;
  final String name;
  final bool requiresSim;

  @override
  List<Object?> get props => <Object?>[id, code, name, requiresSim];
}

/// A concrete model within a type, from `GET /machine-models`. The type comes
/// nested, which is what lets the form react to a model choice without a second
/// request.
///
/// Admin screens request `rawTranslations=true`, which fills [nameAr]/[nameEn]
/// so both locales can be edited without a second round trip.
class MachineModelEntity extends Equatable {
  const MachineModelEntity({
    required this.id,
    required this.code,
    required this.name,
    required this.type,
    this.manufacturer,
    this.isActive = true,
    this.nameAr,
    this.nameEn,
  });

  final String id;
  final String code;
  final String name;
  final String? manufacturer;
  final MachineTypeEntity type;
  final bool isActive;

  /// Present when the list was fetched with `rawTranslations=true`.
  final String? nameAr;
  final String? nameEn;

  /// What the selector shows on one line: two models from different makers can
  /// carry near-identical names.
  String get label => manufacturer == null || manufacturer!.isEmpty
      ? name
      : '$name — $manufacturer';

  @override
  List<Object?> get props => <Object?>[
    id,
    code,
    name,
    manufacturer,
    type,
    isActive,
    nameAr,
    nameEn,
  ];
}
