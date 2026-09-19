import 'package:machinery/core/constants/api_keys.dart';

/// `POST /machine-models`. [code] is immutable after create — the server
/// rejects patches that try to rename it.
class CreateMachineModelParams {
  const CreateMachineModelParams({
    required this.code,
    required this.nameAr,
    required this.nameEn,
    required this.machineTypeId,
    this.manufacturer,
  });

  final String code;
  final String nameAr;
  final String nameEn;
  final String machineTypeId;
  final String? manufacturer;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      ApiKeys.code: code.trim().toUpperCase(),
      ApiKeys.isActive: true,
      ApiKeys.sortOrder: 0,
      ApiKeys.machineTypeId: machineTypeId,
      if (_isSet(manufacturer)) ApiKeys.manufacturer: manufacturer!.trim(),
      ApiKeys.translations: <String, dynamic>{
        ApiKeys.ar: <String, dynamic>{ApiKeys.name: nameAr.trim()},
        ApiKeys.en: <String, dynamic>{ApiKeys.name: nameEn.trim()},
      },
    };
  }
}

/// `PATCH /machine-models/:id`. Code is never sent — it is set once at create.
class UpdateMachineModelParams {
  const UpdateMachineModelParams({
    required this.nameAr,
    required this.nameEn,
    required this.machineTypeId,
    required this.isActive,
    this.manufacturer,
  });

  final String nameAr;
  final String nameEn;
  final String machineTypeId;
  final bool isActive;
  final String? manufacturer;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      ApiKeys.isActive: isActive,
      ApiKeys.machineTypeId: machineTypeId,
      // Explicit null clears an optional manufacturer the admin wiped.
      ApiKeys.manufacturer: _isSet(manufacturer) ? manufacturer!.trim() : null,
      ApiKeys.translations: <String, dynamic>{
        ApiKeys.ar: <String, dynamic>{ApiKeys.name: nameAr.trim()},
        ApiKeys.en: <String, dynamic>{ApiKeys.name: nameEn.trim()},
      },
    };
  }
}

bool _isSet(String? value) => value != null && value.trim().isNotEmpty;
