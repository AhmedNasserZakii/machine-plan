import 'package:equatable/equatable.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';

/// Which of the unit's four stickers a scan actually read. The battery label
/// sits next to the machine label, so people scan the wrong one often enough
/// that the app has to say which one it got.
enum ScannedSerialKind {
  machine('MACHINE'),
  battery('BATTERY'),
  sim('SIM'),
  box('BOX'),
  unknown('UNKNOWN');

  const ScannedSerialKind(this.value);

  final String value;

  static ScannedSerialKind fromJson(String? raw) {
    return ScannedSerialKind.values.firstWhere(
      (ScannedSerialKind kind) => kind.value == raw,
      orElse: () => ScannedSerialKind.unknown,
    );
  }
}

class MachineLookupResult extends Equatable {
  const MachineLookupResult({required this.matchedOn, required this.machine});

  final ScannedSerialKind matchedOn;
  final MachineEntity machine;

  @override
  List<Object?> get props => <Object?>[matchedOn, machine];
}
