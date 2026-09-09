import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';

/// `GET /branches`. The nested warehouse is ignored on purpose — no screen in
/// this feature needs it.
class BranchModel {
  const BranchModel({
    required this.id,
    required this.code,
    required this.name,
    this.isActive = true,
  });

  final String id;
  final String code;
  final String name;
  final bool isActive;

  factory BranchModel.fromJson(Map<String, dynamic> json) {
    return BranchModel(
      id: json[ApiKeys.id]?.toString() ?? '',
      code: json[ApiKeys.code] as String? ?? '',
      name: json[ApiKeys.name] as String? ?? '',
      isActive: json[ApiKeys.isActive] as bool? ?? true,
    );
  }

  BranchEntity toEntity() {
    return BranchEntity(id: id, code: code, name: name, isActive: isActive);
  }
}
