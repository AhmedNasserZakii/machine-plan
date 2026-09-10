import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/helper/formatters.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';

/// Parses `GET /transfers` rows and `GET /transfers/:id` documents from the
/// same shape — the detail response is the list response plus items, signatures
/// and a payload hash, so one model reads both.
class TransferResponseModel {
  const TransferResponseModel({required this.json});

  factory TransferResponseModel.fromJson(Map<String, dynamic> json) =>
      TransferResponseModel(json: json);

  final Map<String, dynamic> json;

  TransferEntity toEntity() {
    return TransferEntity(
      id: _string(json[ApiKeys.id]) ?? '',
      referenceNo: _string(json[ApiKeys.referenceNo]) ?? '',
      type: TransferType.fromJson(_string(json[ApiKeys.type])),
      direction: TransferDirection.fromJson(_string(json[ApiKeys.direction])),
      status: TransferStatus.fromJson(_string(json[ApiKeys.status])),
      from: _party(json[ApiKeys.from]),
      to: _party(json[ApiKeys.to]),
      occurredAt:
          Formatters.tryParseDate(_string(json[ApiKeys.occurredAt])) ??
          DateTime.now(),
      itemsCount: _int(json[ApiKeys.itemsCount]) ?? 0,
      createdAt:
          Formatters.tryParseDate(_string(json[ApiKeys.createdAt])) ??
          DateTime.now(),
      branchId: _string(_map(json[ApiKeys.branch])?[ApiKeys.id]),
      branchName: _string(_map(json[ApiKeys.branch])?[ApiKeys.name]),
      confirmedAt: Formatters.tryParseDate(_string(json[ApiKeys.confirmedAt])),
      items: _list(json[ApiKeys.items]).map(_item).toList(growable: false),
      signatures: _list(
        json[ApiKeys.signatures],
      ).map(_signature).toList(growable: false),
      violationsCount: _int(json[ApiKeys.violationsCount]) ?? 0,
      rejectionReason: _string(json[ApiKeys.rejectionReason]),
      notes: _string(json[ApiKeys.notes]),
      payloadHash: _string(json[ApiKeys.payloadHash]),
    );
  }

  TransferPartyEntity _party(dynamic raw) {
    final Map<String, dynamic>? party = _map(raw);

    return TransferPartyEntity(
      type: PartyType.fromJson(_string(party?[ApiKeys.type])),
      id: _string(party?[ApiKeys.id]),
      name: _string(party?[ApiKeys.name]),
    );
  }

  TransferItemEntity _item(Map<String, dynamic> raw) {
    final Map<String, dynamic>? machine = _map(raw[ApiKeys.machine]);

    return TransferItemEntity(
      id: _string(raw[ApiKeys.id]) ?? '',
      machine: TransferMachineRefEntity(
        id: _string(machine?[ApiKeys.id]) ?? '',
        serial: _string(machine?[ApiKeys.serial]) ?? '',
        model: _string(machine?[ApiKeys.model]),
      ),
      hasCharger: _bool(raw[ApiKeys.hasCharger]) ?? true,
      hasBox: _bool(raw[ApiKeys.hasBox]) ?? false,
      condition: ItemCondition.fromJson(_string(raw[ApiKeys.condition])),
      batterySerialScanned: _string(raw[ApiKeys.batterySerialScanned]),
      // Left null when absent rather than coerced: an unscanned serial is not
      // the same fact as a mismatched one.
      batteryMatches: _bool(raw[ApiKeys.batteryMatches]),
      simSerialScanned: _string(raw[ApiKeys.simSerialScanned]),
      simMatches: _bool(raw[ApiKeys.simMatches]),
      boxSerialScanned: _string(raw[ApiKeys.boxSerialScanned]),
      boxMatches: _bool(raw[ApiKeys.boxMatches]),
      notes: _string(raw[ApiKeys.notes]),
      photoMediaIds: _list(raw[ApiKeys.photos])
          .map((Map<String, dynamic> photo) => _string(photo[ApiKeys.mediaId]))
          .whereType<String>()
          .toList(growable: false),
    );
  }

  TransferSignatureEntity _signature(Map<String, dynamic> raw) {
    return TransferSignatureEntity(
      id: _string(raw[ApiKeys.id]) ?? '',
      partyRole: SignaturePartyRole.fromJson(_string(raw[ApiKeys.partyRole])),
      userId: _string(raw[ApiKeys.userId]) ?? '',
      method: SignatureMethod.fromJson(_string(raw[ApiKeys.method])),
      signedAt:
          Formatters.tryParseDate(_string(raw[ApiKeys.signedAt])) ??
          DateTime.now(),
      payloadHash: _string(raw[ApiKeys.payloadHash]) ?? '',
      userFullName: _string(raw[ApiKeys.userFullName]),
      signatureMediaId: _string(raw[ApiKeys.signatureMediaId]),
      deviceModel: _string(raw[ApiKeys.deviceModel]),
    );
  }
}

Map<String, dynamic>? _map(dynamic raw) =>
    raw is Map<String, dynamic> ? raw : null;

List<Map<String, dynamic>> _list(dynamic raw) => raw is List<dynamic>
    ? raw.whereType<Map<String, dynamic>>().toList(growable: false)
    : const <Map<String, dynamic>>[];

String? _string(dynamic raw) {
  if (raw is String) return raw.isEmpty ? null : raw;
  return null;
}

int? _int(dynamic raw) => raw is num ? raw.toInt() : null;

bool? _bool(dynamic raw) => raw is bool ? raw : null;
