import 'package:equatable/equatable.dart';
import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/core/utils/enums.dart';

/// What the signature pad produced, ready to be attached to a transfer.
///
/// A drawn signature is an uploaded PNG; a biometric one is the device's word
/// that it verified a fingerprint. Either way the server records who signed,
/// when, and against which payload hash.
class SignatureParams extends Equatable {
  const SignatureParams({
    required this.method,
    this.signatureMediaId,
    this.deviceId,
    this.deviceModel,
  });

  final SignatureMethod method;
  final String? signatureMediaId;
  final String? deviceId;
  final String? deviceModel;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.method: method.value,
    if (signatureMediaId != null) ApiKeys.signatureMediaId: signatureMediaId,
    if (deviceId != null) ApiKeys.deviceId: deviceId,
    if (deviceModel != null) ApiKeys.deviceModel: deviceModel,
  };

  @override
  List<Object?> get props => <Object?>[
    method,
    signatureMediaId,
    deviceId,
    deviceModel,
  ];
}

/// One machine on its way out, as the sender declares it.
class TransferItemParams extends Equatable {
  const TransferItemParams({
    required this.machineId,
    // The ordinary case, which the sender then corrects: a unit leaves with its
    // charger, in working order. Defaulting these keeps a forty-machine load
    // from being forty identical taps.
    this.hasCharger = true,
    this.hasBox = false,
    this.condition = ItemCondition.good,
    this.batterySerialScanned,
    this.simSerialScanned,
    this.boxSerialScanned,
    this.notes,
    this.photoMediaIds = const <String>[],
  });

  final String machineId;
  final bool hasCharger;
  final bool hasBox;
  final ItemCondition condition;

  /// Omitted entirely when nobody scanned it — an unscanned serial makes no
  /// claim, and sending an empty string would record a mismatch.
  final String? batterySerialScanned;
  final String? simSerialScanned;
  final String? boxSerialScanned;
  final String? notes;
  final List<String> photoMediaIds;

  TransferItemParams copyWith({
    bool? hasCharger,
    bool? hasBox,
    ItemCondition? condition,
    String? batterySerialScanned,
    String? simSerialScanned,
    String? boxSerialScanned,
    String? notes,
    List<String>? photoMediaIds,
    bool resetBatterySerial = false,
  }) {
    return TransferItemParams(
      machineId: machineId,
      hasCharger: hasCharger ?? this.hasCharger,
      hasBox: hasBox ?? this.hasBox,
      condition: condition ?? this.condition,
      batterySerialScanned: resetBatterySerial
          ? null
          : (batterySerialScanned ?? this.batterySerialScanned),
      simSerialScanned: simSerialScanned ?? this.simSerialScanned,
      boxSerialScanned: boxSerialScanned ?? this.boxSerialScanned,
      notes: notes ?? this.notes,
      photoMediaIds: photoMediaIds ?? this.photoMediaIds,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.machineId: machineId,
    ApiKeys.hasCharger: hasCharger,
    ApiKeys.hasBox: hasBox,
    ApiKeys.condition: condition.value,
    if (_isSet(batterySerialScanned))
      ApiKeys.batterySerialScanned: batterySerialScanned!.trim(),
    if (_isSet(simSerialScanned))
      ApiKeys.simSerialScanned: simSerialScanned!.trim(),
    if (_isSet(boxSerialScanned))
      ApiKeys.boxSerialScanned: boxSerialScanned!.trim(),
    if (_isSet(notes)) ApiKeys.notes: notes!.trim(),
    if (photoMediaIds.isNotEmpty) ApiKeys.photoMediaIds: photoMediaIds,
  };

  @override
  List<Object?> get props => <Object?>[
    machineId,
    hasCharger,
    hasBox,
    condition,
    batterySerialScanned,
    simSerialScanned,
    boxSerialScanned,
    notes,
    photoMediaIds,
  ];
}

class CreateTransferParams extends Equatable {
  const CreateTransferParams({
    required this.clientUuid,
    required this.type,
    required this.occurredAt,
    required this.items,
    this.toPartyId,
    this.notes,
    this.senderSignature,
  });

  /// Generated on the device before the request leaves it. Replaying it returns
  /// the original transfer instead of dispatching the machines twice, which is
  /// what makes a retry on a bad connection safe.
  final String clientUuid;
  final TransferType type;
  final DateTime occurredAt;
  final List<TransferItemParams> items;
  final String? toPartyId;
  final String? notes;
  final SignatureParams? senderSignature;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.clientUuid: clientUuid,
    ApiKeys.type: type.value,
    ApiKeys.occurredAt: occurredAt.toUtc().toIso8601String(),
    ApiKeys.items: items
        .map((TransferItemParams item) => item.toJson())
        .toList(growable: false),
    if (toPartyId != null) ApiKeys.toPartyId: toPartyId,
    if (_isSet(notes)) ApiKeys.notes: notes!.trim(),
    if (senderSignature != null)
      ApiKeys.senderSignature: senderSignature!.toJson(),
  };

  @override
  List<Object?> get props => <Object?>[
    clientUuid,
    type,
    occurredAt,
    items,
    toPartyId,
    notes,
    senderSignature,
  ];
}

/// The receiver's correction to one row. Only the fields he changed are sent —
/// an absent field means "the sender's declaration stands".
class ItemAdjustmentParams extends Equatable {
  const ItemAdjustmentParams({
    required this.transferItemId,
    this.hasCharger,
    this.hasBox,
    this.condition,
    this.batterySerialScanned,
    this.simSerialScanned,
    this.boxSerialScanned,
    this.notes,
  });

  final String transferItemId;
  final bool? hasCharger;
  final bool? hasBox;
  final ItemCondition? condition;
  final String? batterySerialScanned;
  final String? simSerialScanned;
  final String? boxSerialScanned;
  final String? notes;

  bool get isEmpty =>
      hasCharger == null &&
      hasBox == null &&
      condition == null &&
      batterySerialScanned == null &&
      simSerialScanned == null &&
      boxSerialScanned == null &&
      notes == null;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.transferItemId: transferItemId,
    if (hasCharger != null) ApiKeys.hasCharger: hasCharger,
    if (hasBox != null) ApiKeys.hasBox: hasBox,
    if (condition != null) ApiKeys.condition: condition!.value,
    if (_isSet(batterySerialScanned))
      ApiKeys.batterySerialScanned: batterySerialScanned!.trim(),
    if (_isSet(simSerialScanned))
      ApiKeys.simSerialScanned: simSerialScanned!.trim(),
    if (_isSet(boxSerialScanned))
      ApiKeys.boxSerialScanned: boxSerialScanned!.trim(),
    if (_isSet(notes)) ApiKeys.notes: notes!.trim(),
  };

  @override
  List<Object?> get props => <Object?>[
    transferItemId,
    hasCharger,
    hasBox,
    condition,
    batterySerialScanned,
    simSerialScanned,
    boxSerialScanned,
    notes,
  ];
}

class ConfirmTransferParams extends Equatable {
  const ConfirmTransferParams({
    required this.signature,
    required this.payloadHash,
    this.adjustments = const <ItemAdjustmentParams>[],
  });

  final SignatureParams signature;

  /// The hash of what the receiver actually read. A mismatch means the document
  /// changed after this screen loaded, and the server refuses the signature.
  final String payloadHash;
  final List<ItemAdjustmentParams> adjustments;

  Map<String, dynamic> toJson() => <String, dynamic>{
    ApiKeys.signature: signature.toJson(),
    ApiKeys.payloadHash: payloadHash,
    if (adjustments.isNotEmpty)
      ApiKeys.adjustments: adjustments
          .map((ItemAdjustmentParams adjustment) => adjustment.toJson())
          .toList(growable: false),
  };

  @override
  List<Object?> get props => <Object?>[signature, payloadHash, adjustments];
}

bool _isSet(String? value) => value != null && value.trim().isNotEmpty;
