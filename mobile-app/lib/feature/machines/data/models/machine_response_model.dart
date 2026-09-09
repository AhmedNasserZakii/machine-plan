import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';

/// `GET /machines`, `GET /machines/:id` and the two write endpoints.
///
/// The list row and the detail body are the same shape with the detail carrying
/// four extra blocks, so one parser covers both: the blocks it does not find
/// fall back to their empty forms rather than making the caller pick a model.
class MachineResponseModel {
  const MachineResponseModel({required this.entity});

  final MachineEntity entity;

  factory MachineResponseModel.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> type = _object(json[ApiKeys.type]);
    final Map<String, dynamic> model = _object(json[ApiKeys.model]);
    final Map<String, dynamic> battery = _object(json[ApiKeys.battery]);
    final Map<String, dynamic> branch = _object(json[ApiKeys.branch]);
    final Map<String, dynamic> holder = _object(json[ApiKeys.holder]);
    final Map<String, dynamic> warranty = _object(json[ApiKeys.warranty]);
    final Map<String, dynamic> purchase = _object(json[ApiKeys.purchase]);
    final Map<String, dynamic> maintenance = _object(json[ApiKeys.maintenance]);

    return MachineResponseModel(
      entity: MachineEntity(
        id: json[ApiKeys.id]?.toString() ?? '',
        serial: json[ApiKeys.serial] as String? ?? '',
        simSerial: json[ApiKeys.simSerial] as String?,
        boxSerial: json[ApiKeys.boxSerial] as String?,
        qrPayload: json[ApiKeys.qrPayload] as String?,
        status: MachineStatus.fromJson(json[ApiKeys.status] as String?),
        hasBox: json[ApiKeys.hasBox] as bool? ?? false,
        type: MachineTypeRef(
          id: type[ApiKeys.id]?.toString() ?? '',
          name: type[ApiKeys.name] as String? ?? '',
          // Defaults to true so a missing flag hides nothing: a form that asks
          // for a SIM it did not need is a worse failure than one that omits it.
          requiresSim: type[ApiKeys.requiresSim] as bool? ?? true,
        ),
        model: MachineModelRef(
          id: model[ApiKeys.id]?.toString() ?? '',
          name: model[ApiKeys.name] as String? ?? '',
          manufacturer: model[ApiKeys.manufacturer] as String?,
        ),
        battery: battery.isEmpty
            ? null
            : BatteryRef(
                id: battery[ApiKeys.id]?.toString() ?? '',
                serial: battery[ApiKeys.serial] as String? ?? '',
              ),
        branch: branch.isEmpty
            ? null
            : BranchRef(
                id: branch[ApiKeys.id]?.toString() ?? '',
                name: branch[ApiKeys.name] as String? ?? '',
              ),
        holder: holder.isEmpty
            ? null
            : MachineHolder(
                type: PartyType.fromJson(holder[ApiKeys.type] as String?),
                id: holder[ApiKeys.id]?.toString(),
              ),
        warranty: MachineWarranty(
          start: warranty[ApiKeys.start] as String?,
          end: warranty[ApiKeys.end] as String?,
          isActive: warranty[ApiKeys.isActive] as bool? ?? false,
          daysRemaining: _int(warranty[ApiKeys.daysRemaining]),
        ),
        purchase: MachinePurchase(
          price: _double(purchase[ApiKeys.price]),
          date: purchase[ApiKeys.date] as String?,
          invoiceNo: purchase[ApiKeys.invoiceNo] as String?,
        ),
        maintenance: MachineMaintenance(
          repairCount: _int(maintenance[ApiKeys.repairCount]),
          totalRepairCost: _double(maintenance[ApiKeys.totalRepairCost]) ?? 0,
          costVsPricePercent: _double(maintenance[ApiKeys.costVsPricePercent]),
        ),
        notes: json[ApiKeys.notes] as String?,
        decommissionedAt: _dateOrNull(json[ApiKeys.decommissionedAt]),
        replacedByMachineId: json[ApiKeys.replacedByMachineId]?.toString(),
        replacesMachineId: json[ApiKeys.replacesMachineId]?.toString(),
      ),
    );
  }

  MachineEntity toEntity() => entity;

  static Map<String, dynamic> _object(dynamic raw) =>
      raw is Map<String, dynamic> ? raw : const <String, dynamic>{};

  /// `pg` sends `numeric` columns as strings so no precision is lost in
  /// transit, and JSON numbers arrive as `int` when they happen to be whole.
  static double? _double(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  static int _int(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  /// A malformed timestamp must not take the whole list down with it.
  static DateTime? _dateOrNull(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value)?.toLocal();
  }
}
