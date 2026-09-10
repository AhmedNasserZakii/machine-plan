import 'package:equatable/equatable.dart';
import 'package:machinery/core/lookups/lookup_entity.dart';
import 'package:machinery/feature/maintenance/domain/entities/maintenance_entity.dart';

sealed class MaintenanceCreateState extends Equatable {
  const MaintenanceCreateState();

  @override
  List<Object?> get props => <Object?>[];
}

class MaintenanceCreateLoading extends MaintenanceCreateState {
  const MaintenanceCreateLoading();
}

class MaintenanceCreateLoadFailure extends MaintenanceCreateState {
  const MaintenanceCreateLoadFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}

class MaintenanceCreateReady extends MaintenanceCreateState {
  const MaintenanceCreateReady({
    required this.locations,
    this.locationId,
    this.sentAt,
    this.isSubmitting = false,
  });

  final List<LookupEntity> locations;
  final String? locationId;
  final String? sentAt;
  final bool isSubmitting;

  MaintenanceCreateReady copyWith({
    String? locationId,
    String? sentAt,
    bool? isSubmitting,
  }) {
    return MaintenanceCreateReady(
      locations: locations,
      locationId: locationId ?? this.locationId,
      sentAt: sentAt ?? this.sentAt,
      isSubmitting: isSubmitting ?? this.isSubmitting,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    locations,
    locationId,
    sentAt,
    isSubmitting,
  ];
}

/// Emitted once on success so the screen can pop with the new order.
class MaintenanceCreateSubmitted extends MaintenanceCreateState {
  const MaintenanceCreateSubmitted({required this.order});

  final MaintenanceOrderEntity order;

  @override
  List<Object?> get props => <Object?>[order];
}

class MaintenanceCreateSubmitFailure extends MaintenanceCreateState {
  const MaintenanceCreateSubmitFailure({required this.errorMessage});

  final String errorMessage;

  @override
  List<Object?> get props => <Object?>[errorMessage];
}
