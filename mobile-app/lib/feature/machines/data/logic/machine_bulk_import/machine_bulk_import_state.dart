import 'package:equatable/equatable.dart';
import 'package:machinery/feature/machines/domain/entities/machine_catalogue_entity.dart';

/// One row of the batch being typed in. [key] is a stable local identity for
/// Flutter's list widgets — an index would shift under a row that gets
/// removed from the middle of the list.
class MachineImportRow extends Equatable {
  const MachineImportRow({
    required this.key,
    this.serial = '',
    this.batterySerial = '',
    this.simSerial = '',
    this.boxSerial = '',
  });

  final String key;
  final String serial;
  final String batterySerial;
  final String simSerial;
  final String boxSerial;

  MachineImportRow copyWith({
    String? serial,
    String? batterySerial,
    String? simSerial,
    String? boxSerial,
  }) {
    return MachineImportRow(
      key: key,
      serial: serial ?? this.serial,
      batterySerial: batterySerial ?? this.batterySerial,
      simSerial: simSerial ?? this.simSerial,
      boxSerial: boxSerial ?? this.boxSerial,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    key,
    serial,
    batterySerial,
    simSerial,
    boxSerial,
  ];
}

sealed class MachineBulkImportState extends Equatable {
  const MachineBulkImportState();

  @override
  List<Object?> get props => <Object?>[];
}

class MachineBulkImportLoading extends MachineBulkImportState {
  const MachineBulkImportLoading();
}

class MachineBulkImportLoadFailure extends MachineBulkImportState {
  const MachineBulkImportLoadFailure({
    required this.errorMessage,
    this.isOffline = false,
  });

  final String errorMessage;
  final bool isOffline;

  @override
  List<Object?> get props => <Object?>[errorMessage, isOffline];
}

/// The whole batch shares one model, one box/warranty/purchase story — this is
/// one shipment arriving together, not several unrelated intakes typed side by
/// side. Only the four serials vary row to row.
class MachineBulkImportReady extends MachineBulkImportState {
  const MachineBulkImportReady({
    required this.models,
    required this.rows,
    this.selectedModel,
    this.hasBox = true,
    this.purchasePrice,
    this.purchaseDate,
    this.factoryInvoiceNo,
    this.warrantyStart,
    this.warrantyEnd,
    this.notes,
    this.isSubmitting = false,
    this.rowErrors = const <int, Map<String, String>>{},
    this.generalError,
  });

  final List<MachineModelEntity> models;
  final List<MachineImportRow> rows;
  final MachineModelEntity? selectedModel;
  final bool hasBox;
  final double? purchasePrice;
  final String? purchaseDate;
  final String? factoryInvoiceNo;
  final String? warrantyStart;
  final String? warrantyEnd;
  final String? notes;
  final bool isSubmitting;

  /// Row index -> field -> constraint text, parsed from the server's
  /// `machines[N].field: constraint` detail lines.
  final Map<int, Map<String, String>> rowErrors;

  /// A problem line that did not match the `machines[N].field` shape — shown
  /// once, above the rows, rather than dropped.
  final String? generalError;

  bool get requiresSim => selectedModel?.type.requiresSim ?? true;

  MachineBulkImportReady copyWith({
    List<MachineModelEntity>? models,
    List<MachineImportRow>? rows,
    MachineModelEntity? selectedModel,
    bool? hasBox,
    double? purchasePrice,
    String? purchaseDate,
    String? factoryInvoiceNo,
    String? warrantyStart,
    String? warrantyEnd,
    String? notes,
    bool? isSubmitting,
    Map<int, Map<String, String>>? rowErrors,
    String? generalError,
    bool clearErrors = false,
  }) {
    return MachineBulkImportReady(
      models: models ?? this.models,
      rows: rows ?? this.rows,
      selectedModel: selectedModel ?? this.selectedModel,
      hasBox: hasBox ?? this.hasBox,
      purchasePrice: purchasePrice ?? this.purchasePrice,
      purchaseDate: purchaseDate ?? this.purchaseDate,
      factoryInvoiceNo: factoryInvoiceNo ?? this.factoryInvoiceNo,
      warrantyStart: warrantyStart ?? this.warrantyStart,
      warrantyEnd: warrantyEnd ?? this.warrantyEnd,
      notes: notes ?? this.notes,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      rowErrors: clearErrors
          ? const <int, Map<String, String>>{}
          : (rowErrors ?? this.rowErrors),
      generalError: clearErrors ? null : (generalError ?? this.generalError),
    );
  }

  @override
  List<Object?> get props => <Object?>[
    models,
    rows,
    selectedModel,
    hasBox,
    purchasePrice,
    purchaseDate,
    factoryInvoiceNo,
    warrantyStart,
    warrantyEnd,
    notes,
    isSubmitting,
    rowErrors,
    generalError,
  ];
}

/// Emitted once on success so the screen can pop and the list can refresh.
class MachineBulkImportSubmitted extends MachineBulkImportState {
  const MachineBulkImportSubmitted({required this.createdCount});

  final int createdCount;

  @override
  List<Object?> get props => <Object?>[createdCount];
}
