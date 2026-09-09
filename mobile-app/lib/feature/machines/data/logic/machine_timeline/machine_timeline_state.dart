import 'package:equatable/equatable.dart';
import 'package:machinery/feature/machines/domain/entities/machine_timeline_event.dart';

sealed class MachineTimelineState extends Equatable {
  const MachineTimelineState();

  @override
  List<Object?> get props => <Object?>[];
}

class MachineTimelineLoading extends MachineTimelineState {
  const MachineTimelineLoading();
}

class MachineTimelineLoaded extends MachineTimelineState {
  const MachineTimelineLoaded({
    required this.events,
    required this.hasNext,
    this.cursor,
    this.isLoadingMore = false,
  });

  final List<MachineTimelineEvent> events;
  final bool hasNext;
  final String? cursor;
  final bool isLoadingMore;

  MachineTimelineLoaded copyWith({
    List<MachineTimelineEvent>? events,
    bool? hasNext,
    String? cursor,
    bool? isLoadingMore,
  }) {
    return MachineTimelineLoaded(
      events: events ?? this.events,
      hasNext: hasNext ?? this.hasNext,
      cursor: cursor ?? this.cursor,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    );
  }

  @override
  List<Object?> get props => <Object?>[events, hasNext, cursor, isLoadingMore];
}

class MachineTimelineFailure extends MachineTimelineState {
  const MachineTimelineFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}
