import 'package:equatable/equatable.dart';

class UserCustodySummary extends Equatable {
  const UserCustodySummary({
    required this.totalMachines,
    required this.withMerchants,
    required this.inHand,
    required this.openViolations,
  });

  final int totalMachines;
  final int withMerchants;
  final int inHand;
  final int openViolations;

  @override
  List<Object?> get props => <Object?>[
    totalMachines,
    withMerchants,
    inHand,
    openViolations,
  ];
}

class UserCustodyMachine extends Equatable {
  const UserCustodyMachine({
    required this.id,
    required this.serial,
    required this.model,
    required this.status,
    required this.heldSince,
    this.merchantId,
    this.merchantName,
  });

  final String id;
  final String serial;
  final String model;
  final String status;
  final DateTime heldSince;
  final String? merchantId;
  final String? merchantName;

  @override
  List<Object?> get props => <Object?>[
    id,
    serial,
    model,
    status,
    heldSince,
    merchantId,
    merchantName,
  ];
}

class UserCustodyEntity extends Equatable {
  const UserCustodyEntity({required this.summary, required this.machines});

  final UserCustodySummary summary;
  final List<UserCustodyMachine> machines;

  @override
  List<Object?> get props => <Object?>[summary, machines];
}
