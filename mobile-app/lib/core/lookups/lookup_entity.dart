import 'package:equatable/equatable.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/utils/enums.dart';

/// One row of a reference table. `name` arrives already resolved for the
/// requested locale, so the app never sees a translations array.
class LookupEntity extends Equatable {
  const LookupEntity({
    required this.id,
    required this.code,
    required this.name,
    this.isActive = true,
    this.sortOrder = 0,
  });

  factory LookupEntity.fromJson(Map<String, dynamic> json) {
    return LookupEntity(
      id: json[ApiKeys.id]?.toString() ?? '',
      code: json[ApiKeys.code] as String? ?? '',
      name: json[ApiKeys.name] as String? ?? '',
      isActive: json[ApiKeys.isActive] as bool? ?? true,
      sortOrder: json[ApiKeys.sortOrder] is num
          ? (json[ApiKeys.sortOrder] as num).toInt()
          : 0,
    );
  }

  final String id;
  final String code;
  final String name;
  final bool isActive;
  final int sortOrder;

  @override
  List<Object?> get props => <Object?>[id, code, name, isActive, sortOrder];
}

/// A violation type carries the severity the register defaults to when someone
/// raises one by hand, so the form does not have to guess.
class ViolationTypeEntity extends LookupEntity {
  const ViolationTypeEntity({
    required super.id,
    required super.code,
    required super.name,
    required this.defaultSeverity,
    super.isActive,
    super.sortOrder,
  });

  factory ViolationTypeEntity.fromJson(Map<String, dynamic> json) {
    final LookupEntity base = LookupEntity.fromJson(json);

    return ViolationTypeEntity(
      id: base.id,
      code: base.code,
      name: base.name,
      isActive: base.isActive,
      sortOrder: base.sortOrder,
      defaultSeverity: ViolationSeverity.fromJson(
        json[ApiKeys.defaultSeverity] as String?,
      ),
    );
  }

  final ViolationSeverity defaultSeverity;

  @override
  List<Object?> get props => <Object?>[...super.props, defaultSeverity];
}
