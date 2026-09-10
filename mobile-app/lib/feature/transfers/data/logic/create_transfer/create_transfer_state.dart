import 'package:equatable/equatable.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/transfers/domain/entities/creatable_transfer_type.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo.dart';

/// The four steps of the create wizard, in order.
enum CreateTransferStep { typeAndRecipient, pickMachines, itemDetails, review }

/// A machine the sender has added, plus what he has recorded about it.
///
/// The machine itself is kept alongside so the battery comparison can be made
/// on the device: the representative needs that warning while he is standing in
/// front of the merchant, not after a round trip.
class DraftItem extends Equatable {
  const DraftItem({required this.machine, required this.params});

  final MachineEntity machine;
  final TransferItemParams params;

  /// The battery serial the record says is bonded to this machine.
  String? get expectedBatterySerial => machine.battery?.serial;

  /// `null` when nothing was scanned — an unscanned serial makes no claim
  /// either way. Only a `false` is a mismatch, and even then the hand-off goes
  /// through: it is recorded as a violation, not refused.
  bool? get batteryMatches {
    final String? scanned = params.batterySerialScanned?.trim();
    if (scanned == null || scanned.isEmpty) return null;

    return scanned.toLowerCase() ==
        (expectedBatterySerial ?? '').trim().toLowerCase();
  }

  DraftItem copyWith({TransferItemParams? params}) =>
      DraftItem(machine: machine, params: params ?? this.params);

  @override
  List<Object?> get props => <Object?>[machine, params];
}

class CreateTransferState extends Equatable {
  const CreateTransferState({
    required this.clientUuid,
    this.step = CreateTransferStep.typeAndRecipient,
    this.availableTypes = const <CreatableTransferType>[],
    this.isLoadingTypes = true,
    this.selected,
    this.recipients = const <TransferRecipient>[],
    this.recipientId,
    this.merchantId,
    this.merchantName,
    this.items = const <DraftItem>[],
    this.notes,
    this.isLoadingRecipients = false,
    this.isValidating = false,
    this.isSubmitting = false,
    this.validationProblems = const <String>[],
    this.errorMessage,
    this.created,
  });

  /// Generated once, when the wizard opens, and reused by every retry. This is
  /// what makes a resubmit on a flaky connection safe rather than a second
  /// dispatch of the same machines.
  final String clientUuid;

  final CreateTransferStep step;

  /// Only the moves this caller can actually initiate, as the server reports
  /// them. A representative is never offered "hand to a branch".
  final List<CreatableTransferType> availableTypes;
  final bool isLoadingTypes;
  final CreatableTransferType? selected;

  final List<TransferRecipient> recipients;
  final bool isLoadingRecipients;
  final String? recipientId;

  /// A merchant has no account, so the id is typed rather than picked until the
  /// merchants module lands.
  final String? merchantId;

  /// Set only when the merchant was picked via the "تاجر جديد" shortcut or an
  /// existing merchant lookup; `null` for a bare typed id, which the signing
  /// screen then shows as-is rather than blank.
  final String? merchantName;

  final List<DraftItem> items;
  final String? notes;
  final bool isValidating;
  final bool isSubmitting;

  /// What the dry run said was wrong. Surfaced before the review step, never
  /// after — a representative must not collect a signature for a hand-off that
  /// cannot go through.
  final List<String> validationProblems;
  final String? errorMessage;
  final TransferEntity? created;

  TransferType? get type => selected?.type;

  /// The id the request carries, whichever kind of receiver this type wants.
  String? get toPartyId => switch (selected?.receiverKind) {
    ReceiverKind.merchant => merchantId,
    ReceiverKind.user || ReceiverKind.warehouse => recipientId,
    _ => null,
  };

  /// What the signing screen shows as "المستلم" — resolved from whichever
  /// list this receiver kind actually picks from, since a merchant's name
  /// lives nowhere but this state and a user/warehouse's lives in [recipients].
  String? get recipientDisplayName => switch (selected?.receiverKind) {
    ReceiverKind.merchant => merchantName ?? merchantId,
    ReceiverKind.user || ReceiverKind.warehouse => recipients
        .cast<TransferRecipient?>()
        .firstWhere(
          (TransferRecipient? r) => r?.id == recipientId,
          orElse: () => null,
        )
        ?.name,
    _ => null,
  };

  /// A signature is needed on the client only when the sender closes the
  /// document himself — every other move signs on `confirm`, which the
  /// receiver does (`9.4`). Mirrors the backend's own gate exactly:
  /// `signatureNeeded = rule.autoConfirm || rule.signatures.includes(SENDER)`
  /// (`transfers.service.ts`) reduces to `rule.autoConfirm` for every type in
  /// this app's `TRANSFER_RULES`, which is exactly what `selfAttested` is.
  bool get needsSenderSignature => selected?.selfAttested ?? false;

  int get mismatchCount =>
      items.where((DraftItem item) => item.batteryMatches == false).length;

  int get missingChargerCount =>
      items.where((DraftItem item) => !item.params.hasCharger).length;

  bool get canLeaveTypeStep =>
      selected != null &&
      (selected!.receiverKind == ReceiverKind.none || toPartyId != null);

  bool get canLeaveMachinesStep => items.isNotEmpty;

  /// True when this machine cannot go this way — it is somewhere else in the
  /// custody graph. Greying it out beats a 422 after twenty scans.
  bool isEligible(MachineEntity machine) =>
      selected?.allows(machine.status) ?? false;

  CreateTransferState copyWith({
    CreateTransferStep? step,
    List<CreatableTransferType>? availableTypes,
    bool? isLoadingTypes,
    CreatableTransferType? selected,
    List<TransferRecipient>? recipients,
    String? recipientId,
    String? merchantId,
    String? merchantName,
    List<DraftItem>? items,
    String? notes,
    bool? isLoadingRecipients,
    bool? isValidating,
    bool? isSubmitting,
    List<String>? validationProblems,
    String? errorMessage,
    TransferEntity? created,
    bool clearError = false,
    bool clearRecipient = false,
    bool resetMerchantName = false,
  }) {
    return CreateTransferState(
      clientUuid: clientUuid,
      step: step ?? this.step,
      availableTypes: availableTypes ?? this.availableTypes,
      isLoadingTypes: isLoadingTypes ?? this.isLoadingTypes,
      selected: selected ?? this.selected,
      recipients: recipients ?? this.recipients,
      recipientId: clearRecipient ? null : (recipientId ?? this.recipientId),
      merchantId: clearRecipient ? null : (merchantId ?? this.merchantId),
      merchantName: (clearRecipient || resetMerchantName)
          ? merchantName
          : (merchantName ?? this.merchantName),
      items: items ?? this.items,
      notes: notes ?? this.notes,
      isLoadingRecipients: isLoadingRecipients ?? this.isLoadingRecipients,
      isValidating: isValidating ?? this.isValidating,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      validationProblems: validationProblems ?? this.validationProblems,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      created: created ?? this.created,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    clientUuid,
    step,
    availableTypes,
    isLoadingTypes,
    selected,
    recipients,
    recipientId,
    merchantId,
    merchantName,
    items,
    notes,
    isLoadingRecipients,
    isValidating,
    isSubmitting,
    validationProblems,
    errorMessage,
    created,
  ];
}
