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
    this.address,
    this.phone,
  });

  final String id;
  final String code;
  final String name;
  final bool isActive;
  final String? address;
  final String? phone;

  factory BranchModel.fromJson(Map<String, dynamic> json) {
    return BranchModel(
      id: json[ApiKeys.id]?.toString() ?? '',
      code: json[ApiKeys.code] as String? ?? '',
      name: json[ApiKeys.name] as String? ?? '',
      isActive: json[ApiKeys.isActive] as bool? ?? true,
      address: json[ApiKeys.address] as String?,
      phone: json[ApiKeys.phone] as String?,
    );
  }

  BranchEntity toEntity() {
    return BranchEntity(
      id: id,
      code: code,
      name: name,
      isActive: isActive,
      address: address,
      phone: phone,
    );
  }
}
