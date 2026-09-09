import 'package:machinery/core/constants/api_keys.dart';

/// `POST /machines`. Every serial is set once, here — the update payload has no
/// room for any of them.
class CreateMachineParams {
  const CreateMachineParams({
    required this.serial,
    required this.machineModelId,
    required this.batterySerial,
    required this.hasBox,
    this.simSerial,
    this.boxSerial,
    this.purchasePrice,
    this.purchaseDate,
    this.factoryInvoiceNo,
    this.warrantyStart,
    this.warrantyEnd,
    this.notes,
  });

  final String serial;
  final String machineModelId;
  final String batterySerial;
  final bool hasBox;
  final String? simSerial;
  final String? boxSerial;
  final double? purchasePrice;
  final String? purchaseDate;
  final String? factoryInvoiceNo;
  final String? warrantyStart;
  final String? warrantyEnd;
  final String? notes;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      ApiKeys.serial: serial.trim(),
      ApiKeys.machineModelId: machineModelId,
      ApiKeys.battery: <String, dynamic>{ApiKeys.serial: batterySerial.trim()},
      ApiKeys.hasBox: hasBox,
      // The server distinguishes "absent" from "empty": an empty SIM serial on
      // a type that requires one is a validation error, not a null.
      if (_isSet(simSerial)) ApiKeys.simSerial: simSerial!.trim(),
      if (_isSet(boxSerial)) ApiKeys.boxSerial: boxSerial!.trim(),
      if (purchasePrice != null) ApiKeys.purchasePrice: purchasePrice,
      if (_isSet(purchaseDate)) ApiKeys.purchaseDate: purchaseDate,
      if (_isSet(factoryInvoiceNo))
        ApiKeys.factoryInvoiceNo: factoryInvoiceNo!.trim(),
      if (_isSet(warrantyStart)) ApiKeys.warrantyStart: warrantyStart,
      if (_isSet(warrantyEnd)) ApiKeys.warrantyEnd: warrantyEnd,
      if (_isSet(notes)) ApiKeys.notes: notes!.trim(),
    };
  }
}

/// `PATCH /machines/:id`. No serials, deliberately: the server answers a patch
/// carrying one with `422 SERIAL_IMMUTABLE`, so the form never offers them.
class UpdateMachineParams {
  const UpdateMachineParams({
    this.machineModelId,
    this.purchasePrice,
    this.purchaseDate,
    this.factoryInvoiceNo,
    this.warrantyStart,
    this.warrantyEnd,
    this.notes,
  });

  final String? machineModelId;
  final double? purchasePrice;
  final String? purchaseDate;
  final String? factoryInvoiceNo;
  final String? warrantyStart;
  final String? warrantyEnd;
  final String? notes;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      if (machineModelId != null) ApiKeys.machineModelId: machineModelId,
      if (purchasePrice != null) ApiKeys.purchasePrice: purchasePrice,
      if (_isSet(purchaseDate)) ApiKeys.purchaseDate: purchaseDate,
      if (_isSet(factoryInvoiceNo))
        ApiKeys.factoryInvoiceNo: factoryInvoiceNo!.trim(),
      if (_isSet(warrantyStart)) ApiKeys.warrantyStart: warrantyStart,
      if (_isSet(warrantyEnd)) ApiKeys.warrantyEnd: warrantyEnd,
      if (_isSet(notes)) ApiKeys.notes: notes!.trim(),
    };
  }
}

bool _isSet(String? value) => value != null && value.trim().isNotEmpty;
