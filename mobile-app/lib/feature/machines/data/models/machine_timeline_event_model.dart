import 'package:machinery/core/constants/api_keys.dart';
import 'package:machinery/feature/machines/domain/entities/machine_timeline_event.dart';

/// `GET /machines/:id/timeline` — one row per event, newest first.
class MachineTimelineEventModel {
  const MachineTimelineEventModel({required this.entity});

  final MachineTimelineEvent entity;

  factory MachineTimelineEventModel.fromJson(Map<String, dynamic> json) {
    final dynamic details = json[ApiKeys.details];

    return MachineTimelineEventModel(
      entity: MachineTimelineEvent(
        at: _dateOrNow(json[ApiKeys.at]),
        type: MachineTimelineEventType.fromJson(json[ApiKeys.type] as String?),
        refId: json[ApiKeys.refId]?.toString() ?? '',
        refNo: json[ApiKeys.refNo] as String?,
        details: details is Map<String, dynamic>
            ? details
            : const <String, dynamic>{},
      ),
    );
  }

  MachineTimelineEvent toEntity() => entity;

  static DateTime _dateOrNow(dynamic value) {
    if (value is String) {
      return DateTime.tryParse(value)?.toLocal() ?? DateTime.now();
    }
    return DateTime.now();
  }
}
