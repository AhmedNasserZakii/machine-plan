import 'package:equatable/equatable.dart';
import 'package:machinery/core/utils/enums.dart';

/// What the client must make the user pick as the receiver, if anything.
enum ReceiverKind {
  user('USER'),
  warehouse('WAREHOUSE'),

  /// A merchant has no account, so the id is entered rather than picked.
  merchant('MERCHANT'),

  /// The factory and the scrapyard are not records; there is nobody to choose.
  none('NONE');

  const ReceiverKind(this.value);

  final String value;

  static ReceiverKind fromJson(String? raw) {
    return ReceiverKind.values.firstWhere(
      (ReceiverKind kind) => kind.value == raw,
      orElse: () => ReceiverKind.none,
    );
  }
}

/// One hand-off the signed-in user may start.
///
/// Comes from the server rather than being derived from the role on the device.
/// A director and a supervisor both hold `transfers.create` but may start
/// different types, and that is a property of the rules map — keeping a second
/// copy of it here is how the two drift apart.
class CreatableTransferType extends Equatable {
  const CreatableTransferType({
    required this.type,
    required this.receiverKind,
    required this.selfAttested,
    this.allowedFromStatuses = const <MachineStatus>[],
  });

  final TransferType type;
  final ReceiverKind receiverKind;

  /// Confirms the moment it is created: there is no counterparty account, so
  /// the sender signs for himself.
  final bool selfAttested;

  /// Which statuses a machine may be in to go this way, so the picker can grey
  /// out the rest before the server has to refuse them.
  final List<MachineStatus> allowedFromStatuses;

  bool allows(MachineStatus status) =>
      allowedFromStatuses.isEmpty || allowedFromStatuses.contains(status);

  @override
  List<Object?> get props => <Object?>[
    type,
    receiverKind,
    selfAttested,
    allowedFromStatuses,
  ];
}
