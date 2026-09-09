import 'package:equatable/equatable.dart';

/// How many machines [MachinesRepo.fetchMachines] reports for the caller —
/// the server already narrows this to one branch unless the caller holds
/// `machines.read.all`, so the number is always "what you may see", not
/// "the whole fleet".
class MachinesSummary extends Equatable {
  const MachinesSummary({required this.total});

  final int total;

  @override
  List<Object?> get props => <Object?>[total];
}

/// Transfers waiting on the caller's own signature — the one transfer scope
/// the offline cache also holds, so this is the block that stays meaningful
/// with no connection.
class TransfersSummary extends Equatable {
  const TransfersSummary({required this.pendingForMe});

  final int pendingForMe;

  @override
  List<Object?> get props => <Object?>[pendingForMe];
}

class MerchantsSummary extends Equatable {
  const MerchantsSummary({required this.total});

  final int total;

  @override
  List<Object?> get props => <Object?>[total];
}

/// A representative without `violations.read.all` only ever gets his own
/// count back — the server scopes the list the same way it scopes the
/// violations tab itself.
class ViolationsSummary extends Equatable {
  const ViolationsSummary({required this.open});

  final int open;

  @override
  List<Object?> get props => <Object?>[open];
}

class MaintenanceSummary extends Equatable {
  const MaintenanceSummary({required this.open});

  final int open;

  @override
  List<Object?> get props => <Object?>[open];
}
