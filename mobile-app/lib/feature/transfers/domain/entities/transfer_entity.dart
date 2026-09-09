import 'package:equatable/equatable.dart';
import 'package:machinery/core/utils/enums.dart';

/// One side of a hand-off. The name resolves for users and warehouses; the
/// factory and the scrapyard have no record behind them, so it stays null and
/// the UI falls back to the party label.
class TransferPartyEntity extends Equatable {
  const TransferPartyEntity({required this.type, this.id, this.name});

  final PartyType type;
  final String? id;
  final String? name;

  @override
  List<Object?> get props => <Object?>[type, id, name];
}

class TransferMachineRefEntity extends Equatable {
  const TransferMachineRefEntity({
    required this.id,
    required this.serial,
    this.model,
  });

  final String id;
  final String serial;
  final String? model;

  @override
  List<Object?> get props => <Object?>[id, serial, model];
}

/// One machine inside a hand-off, with what was physically scanned beside it.
///
/// The three `*Matches` flags are tri-state on purpose: `null` means nobody
/// scanned that serial, which is a different thing from a mismatch. Only a
/// `false` is an accusation.
class TransferItemEntity extends Equatable {
  const TransferItemEntity({
    required this.id,
    required this.machine,
    required this.hasCharger,
    required this.hasBox,
    required this.condition,
    this.batterySerialScanned,
    this.batteryMatches,
    this.simSerialScanned,
    this.simMatches,
    this.boxSerialScanned,
    this.boxMatches,
    this.notes,
    this.photoMediaIds = const <String>[],
  });

  final String id;
  final TransferMachineRefEntity machine;
  final bool hasCharger;
  final bool hasBox;
  final ItemCondition condition;
  final String? batterySerialScanned;
  final bool? batteryMatches;
  final String? simSerialScanned;
  final bool? simMatches;
  final String? boxSerialScanned;
  final bool? boxMatches;
  final String? notes;
  final List<String> photoMediaIds;

  /// A recorded mismatch on any serial. Drives the warning badge on the row.
  bool get hasMismatch =>
      batteryMatches == false || simMatches == false || boxMatches == false;

  @override
  List<Object?> get props => <Object?>[
    id,
    machine,
    hasCharger,
    hasBox,
    condition,
    batterySerialScanned,
    batteryMatches,
    simSerialScanned,
    simMatches,
    boxSerialScanned,
    boxMatches,
    notes,
    photoMediaIds,
  ];
}

class TransferSignatureEntity extends Equatable {
  const TransferSignatureEntity({
    required this.partyRole,
    required this.userId,
    required this.method,
    required this.signedAt,
    required this.payloadHash,
    this.userFullName,
    this.signatureMediaId,
    this.deviceModel,
  });

  final SignaturePartyRole partyRole;
  final String userId;
  final SignatureMethod method;
  final DateTime signedAt;
  final String payloadHash;
  final String? userFullName;
  final String? signatureMediaId;
  final String? deviceModel;

  @override
  List<Object?> get props => <Object?>[
    partyRole,
    userId,
    method,
    signedAt,
    payloadHash,
    userFullName,
    signatureMediaId,
    deviceModel,
  ];
}

/// A hand-off document. List rows and the detail screen share this type; the
/// list simply arrives with an empty [items] and [signatures].
class TransferEntity extends Equatable {
  const TransferEntity({
    required this.id,
    required this.referenceNo,
    required this.type,
    required this.direction,
    required this.status,
    required this.from,
    required this.to,
    required this.occurredAt,
    required this.itemsCount,
    required this.createdAt,
    this.branchId,
    this.branchName,
    this.confirmedAt,
    this.items = const <TransferItemEntity>[],
    this.signatures = const <TransferSignatureEntity>[],
    this.violationsCount = 0,
    this.rejectionReason,
    this.notes,
    this.payloadHash,
  });

  final String id;
  final String referenceNo;
  final TransferType type;
  final TransferDirection direction;
  final TransferStatus status;
  final TransferPartyEntity from;
  final TransferPartyEntity to;

  /// When the hand-off physically happened, which routinely predates
  /// [createdAt] — a representative signs in a village and syncs hours later.
  final DateTime occurredAt;
  final int itemsCount;
  final DateTime createdAt;
  final String? branchId;
  final String? branchName;
  final DateTime? confirmedAt;
  final List<TransferItemEntity> items;
  final List<TransferSignatureEntity> signatures;
  final int violationsCount;
  final String? rejectionReason;
  final String? notes;

  /// Echoed back when confirming. The server compares it against the current
  /// item state and refuses the signature if the document has changed since
  /// this screen loaded.
  final String? payloadHash;

  bool get isPending => status == TransferStatus.pending;

  @override
  List<Object?> get props => <Object?>[
    id,
    referenceNo,
    type,
    direction,
    status,
    from,
    to,
    occurredAt,
    itemsCount,
    createdAt,
    branchId,
    branchName,
    confirmedAt,
    items,
    signatures,
    violationsCount,
    rejectionReason,
    notes,
    payloadHash,
  ];
}
