import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/data/models/machine_catalogue_model.dart';
import 'package:machinery/feature/machines/data/models/machine_response_model.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/machines/domain/params/machine_form_params.dart';
import 'package:machinery/feature/machines/domain/params/machines_query_params.dart';

/// Payloads copied from the running API.
///
/// The list row and the detail record are different shapes — the row omits
/// purchase, maintenance and notes — and the catalogue nests the type under
/// `machineType` while a machine nests it under `type`. Every one of those
/// mismatches fails silently at runtime, so they are pinned here.
void main() {
  Map<String, dynamic> decode(String body) =>
      jsonDecode(body) as Map<String, dynamic>;

  test('GET /machines row parses identity, holder and warranty', () {
    final MachineEntity machine = MachineResponseModel.fromJson(
      decode('''
{
  "id": "b52723ff-3efe-454e-bf16-62af2ee9f74a",
  "serial": "SN-1009",
  "simSerial": "8920011234567890008",
  "boxSerial": "BX-1009",
  "status": "UNDER_MAINTENANCE",
  "hasBox": false,
  "type": { "id": "82ab894c", "name": "ماكينة نقاط بيع", "requiresSim": true },
  "model": { "id": "03773af9", "name": "إنجينيكو ديسك 5000", "manufacturer": "Ingenico" },
  "battery": { "id": "d953f8c5", "serial": "BT-91009" },
  "branch": { "id": "84177053", "name": "فرع القاهرة" },
  "holder": { "type": "WAREHOUSE", "id": "5462a927" },
  "warranty": { "start": "2025-02-10", "end": "2026-12-07", "isActive": true, "daysRemaining": 92 }
}
'''),
    ).toEntity();

    expect(machine.serial, 'SN-1009');
    expect(machine.status, MachineStatus.underMaintenance);
    expect(machine.hasBox, isFalse);
    expect(machine.battery?.serial, 'BT-91009');
    expect(machine.holder?.type, PartyType.warehouse);
    expect(machine.branch?.name, 'فرع القاهرة');
    expect(machine.warranty.isActive, isTrue);
    expect(machine.warranty.daysRemaining, 92);

    // 92 days is comfortably inside cover, so nothing should be flagged amber.
    expect(machine.warranty.isExpiringSoon, isFalse);
  });

  test('a machine detail carries purchase and repair figures', () {
    final MachineEntity machine = MachineResponseModel.fromJson(
      decode('''
{
  "id": "b52723ff",
  "serial": "SN-1001",
  "status": "WITH_MERCHANT",
  "hasBox": true,
  "type": { "id": "t1", "name": "محمولة", "requiresSim": true },
  "model": { "id": "m1", "name": "A920" },
  "warranty": { "isActive": false, "daysRemaining": 0 },
  "purchase": { "price": 8500.5, "date": "2024-03-01", "invoiceNo": "INV-77" },
  "maintenance": { "repairCount": 4, "totalRepairCost": 5300, "costVsPricePercent": 62.3 },
  "notes": "رجعت من الصيانة مرتين"
}
'''),
    ).toEntity();

    expect(machine.purchase.price, 8500.5);
    expect(machine.purchase.invoiceNo, 'INV-77');
    expect(machine.maintenance.repairCount, 4);
    expect(machine.maintenance.totalRepairCost, 5300);

    // Past the scrap threshold, which is what puts the warning on the screen.
    expect(machine.maintenance.shouldConsiderScrapping, isTrue);
    expect(machine.notes, isNotNull);
  });

  test('an unknown status degrades instead of throwing', () {
    final MachineEntity machine = MachineResponseModel.fromJson(
      decode('''
{
  "id": "x",
  "serial": "SN-X",
  "status": "SOMETHING_THE_APP_HAS_NOT_SHIPPED_YET",
  "hasBox": false,
  "type": { "id": "t", "name": "t", "requiresSim": false },
  "model": { "id": "m", "name": "m" },
  "warranty": {}
}
'''),
    ).toEntity();

    expect(machine.status, MachineStatus.unknown);
    expect(machine.warranty.isKnown, isFalse);
  });

  test('GET /machine-models nests the type under machineType', () {
    final MachineModelEntity model = MachineModelModel.fromJson(
      decode('''
{
  "id": "49f6a5a7",
  "code": "INGENICO_MOVE_5000",
  "name": "إنجينيكو موف 5000",
  "manufacturer": "Ingenico",
  "machineType": {
    "id": "dd23abdb",
    "code": "MOBILE_POS",
    "name": "ماكينة نقاط بيع محمولة",
    "requiresSim": true
  }
}
'''),
    ).toEntity();

    expect(model.type.requiresSim, isTrue);
    expect(model.label, 'إنجينيكو موف 5000 — Ingenico');
  });

  test('the query drops unset filters rather than sending empty values', () {
    const MachinesQueryParams params = MachinesQueryParams(search: '   ');

    final Map<String, dynamic> query = params.toQuery();

    expect(query.containsKey('search'), isFalse);
    expect(query.containsKey('status'), isFalse);
    expect(query.containsKey('includeRetired'), isFalse);
  });

  test('a create body omits the SIM when the type does not carry one', () {
    const CreateMachineParams params = CreateMachineParams(
      serial: 'SN-2001',
      machineModelId: 'm1',
      batterySerial: 'BT-2001',
      hasBox: true,
    );

    final Map<String, dynamic> body = params.toJson();

    expect(body['serial'], 'SN-2001');
    expect(body.containsKey('simSerial'), isFalse);
  });
}
