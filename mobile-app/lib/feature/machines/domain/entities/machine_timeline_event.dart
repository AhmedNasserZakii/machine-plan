import 'package:equatable/equatable.dart';

/// Mirrors the backend's `TIMELINE_EVENT_TYPES` exactly (`machine-insights.response.ts`).
/// `unknown` exists only so a future server-side addition renders as a generic
/// row instead of crashing the parse.
enum MachineTimelineEventType {
  transferPending('TRANSFER_PENDING'),
  transferConfirmed('TRANSFER_CONFIRMED'),
  transferRejected('TRANSFER_REJECTED'),
  transferCancelled('TRANSFER_CANCELLED'),
  maintenanceOpened('MAINTENANCE_OPENED'),
  maintenanceClosed('MAINTENANCE_CLOSED'),
  violationCreated('VIOLATION_CREATED'),
  machineReplaced('MACHINE_REPLACED'),
  decommissioned('DECOMMISSIONED'),
  decommissionReverted('DECOMMISSION_REVERTED'),
  unknown('UNKNOWN');

  const MachineTimelineEventType(this.value);

  final String value;

  static MachineTimelineEventType fromJson(String? raw) {
    return MachineTimelineEventType.values.firstWhere(
      (MachineTimelineEventType type) => type.value == raw,
      orElse: () => MachineTimelineEventType.unknown,
    );
  }

  bool get isMaintenance =>
      this == MachineTimelineEventType.maintenanceOpened ||
      this == MachineTimelineEventType.maintenanceClosed;
}

/// One line of a machine's life story. [refNo] is the human-readable document
/// number (a transfer or maintenance reference) when the event came from one;
/// [details] carries whatever else the event type wants to show (a rejection
/// reason, a violation code) and is read defensively since the server may add
/// keys the app does not yet know about.
class MachineTimelineEvent extends Equatable {
  const MachineTimelineEvent({
    required this.at,
    required this.type,
    required this.refId,
    this.refNo,
    this.details = const <String, dynamic>{},
  });

  final DateTime at;
  final MachineTimelineEventType type;
  final String refId;
  final String? refNo;
  final Map<String, dynamic> details;

  @override
  List<Object?> get props => <Object?>[at, type, refId, refNo, details];
}
