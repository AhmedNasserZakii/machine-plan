import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/connection/network_info.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/machines/domain/entities/machine_entity.dart';
import 'package:machinery/feature/transfers/data/logic/create_transfer/create_transfer_state.dart';
import 'package:machinery/feature/transfers/domain/entities/creatable_transfer_type.dart';
import 'package:machinery/feature/transfers/domain/entities/transfer_entity.dart';
import 'package:machinery/feature/transfers/domain/params/transfer_write_params.dart';
import 'package:machinery/feature/transfers/domain/repos/transfers_repo.dart';
import 'package:uuid/uuid.dart';

class CreateTransferCubit extends Cubit<CreateTransferState> {
  CreateTransferCubit({required this.transfersRepo, required this.networkInfo})
    : super(CreateTransferState(clientUuid: const Uuid().v4()));

  final TransfersRepo transfersRepo;
  final NetworkInfo networkInfo;

  Future<void> loadTypes() async {
    emit(state.copyWith(isLoadingTypes: true, clearError: true));

    final Either<ServerFailure, List<CreatableTransferType>> result =
        await transfersRepo.fetchCreatableTypes();

    if (isClosed) return;

    emit(
      result.fold(
        (ServerFailure failure) => state.copyWith(
          isLoadingTypes: false,
          errorMessage: failure.errorMessage,
        ),
        (List<CreatableTransferType> types) =>
            state.copyWith(isLoadingTypes: false, availableTypes: types),
      ),
    );
  }

  void selectType(CreatableTransferType option) {
    if (state.selected?.type == option.type) return;

    // Changing the type changes who may receive it and which machines are
    // eligible, so both are dropped rather than silently carried over.
    emit(
      CreateTransferState(
        clientUuid: state.clientUuid,
        availableTypes: state.availableTypes,
        isLoadingTypes: false,
        selected: option,
      ),
    );

    if (option.receiverKind == ReceiverKind.user ||
        option.receiverKind == ReceiverKind.warehouse) {
      loadRecipients();
    }
  }

  Future<void> loadRecipients() async {
    final CreatableTransferType? option = state.selected;
    if (option == null) return;

    emit(state.copyWith(isLoadingRecipients: true, clearError: true));

    final Either<ServerFailure, List<TransferRecipient>> result =
        await transfersRepo.fetchRecipients(type: option.type);

    if (isClosed) return;

    emit(
      result.fold(
        (ServerFailure failure) => state.copyWith(
          isLoadingRecipients: false,
          errorMessage: failure.errorMessage,
        ),
        (List<TransferRecipient> recipients) =>
            state.copyWith(isLoadingRecipients: false, recipients: recipients),
      ),
    );
  }

  void selectRecipient(String? id) => emit(
    id == null
        ? state.copyWith(clearRecipient: true)
        : state.copyWith(recipientId: id, clearError: true),
  );

  void setMerchantId(String? id) {
    final String? trimmed = id?.trim();

    emit(
      trimmed == null || trimmed.isEmpty
          ? state.copyWith(clearRecipient: true)
          : state.copyWith(merchantId: trimmed, clearError: true),
    );
  }

  /// Adds a machine to the draft. Scanning the same unit twice is what happens
  /// when someone loses his place in a stack of forty, so it is a no-op rather
  /// than an error.
  void addMachine(MachineEntity machine) {
    if (state.items.any((DraftItem item) => item.machine.id == machine.id)) {
      return;
    }

    emit(
      state.copyWith(
        items: <DraftItem>[
          ...state.items,
          DraftItem(
            machine: machine,
            params: TransferItemParams(
              machineId: machine.id,
              // Whether the carton travels with it starts from what the record
              // says; the sender corrects it if he is holding otherwise.
              hasBox: machine.hasBox,
            ),
          ),
        ],
        clearError: true,
      ),
    );
  }

  void removeMachine(String machineId) {
    emit(
      state.copyWith(
        items: state.items
            .where((DraftItem item) => item.machine.id != machineId)
            .toList(growable: false),
      ),
    );
  }

  void updateItem(
    String machineId, {
    bool? hasCharger,
    bool? hasBox,
    ItemCondition? condition,
    String? batterySerialScanned,
    String? notes,
    List<String>? photoMediaIds,
  }) {
    emit(
      state.copyWith(
        items: state.items
            .map((DraftItem item) {
              if (item.machine.id != machineId) return item;

              return item.copyWith(
                params: item.params.copyWith(
                  hasCharger: hasCharger,
                  hasBox: hasBox,
                  condition: condition,
                  batterySerialScanned: batterySerialScanned,
                  notes: notes,
                  photoMediaIds: photoMediaIds,
                ),
              );
            })
            .toList(growable: false),
        clearError: true,
      ),
    );
  }

  void setNotes(String? notes) => emit(state.copyWith(notes: notes?.trim()));

  void goTo(CreateTransferStep step) =>
      emit(state.copyWith(step: step, clearError: true));

  void back() {
    final int index = state.step.index;
    if (index == 0) return;

    emit(
      state.copyWith(
        step: CreateTransferStep.values[index - 1],
        clearError: true,
      ),
    );
  }

  /// Runs the server's own create checks without writing, then moves to review.
  /// Deliberately before the review step rather than after it: nobody should
  /// collect a signature for a hand-off that will be refused.
  ///
  /// Offline (`6.4`), there is no dry run to ask for — `POST
  /// /transfers/validate` needs the server's own custody state, which is
  /// exactly what this device cannot reach right now. The hand-off proceeds
  /// to review unchecked; the real check still happens the moment the queue
  /// pushes it, and a custody problem then surfaces as the `CONFLICT` this
  /// app already has a blocking dialog for (`SyncConflictDialog`) rather than
  /// as a validation error caught earlier.
  Future<void> validateAndReview() async {
    if (state.isValidating) return;

    if (!await networkInfo.isConnected) {
      emit(state.copyWith(step: CreateTransferStep.review, clearError: true));
      return;
    }

    emit(
      state.copyWith(
        isValidating: true,
        validationProblems: const <String>[],
        clearError: true,
      ),
    );

    final Either<ServerFailure, TransferValidation> result = await transfersRepo
        .validate(params: _params());

    if (isClosed) return;

    emit(
      result.fold(
        (ServerFailure failure) => state.copyWith(
          isValidating: false,
          errorMessage: failure.errorMessage,
        ),
        (TransferValidation validation) => state.copyWith(
          isValidating: false,
          validationProblems: validation.problems,
          step: validation.valid
              ? CreateTransferStep.review
              : CreateTransferStep.itemDetails,
        ),
      ),
    );
  }

  Future<void> submit() async {
    if (state.isSubmitting) return;

    emit(state.copyWith(isSubmitting: true, clearError: true));

    final Either<ServerFailure, TransferEntity> result = await transfersRepo
        .createTransfer(params: _params());

    if (isClosed) return;

    emit(
      result.fold(
        (ServerFailure failure) => state.copyWith(
          isSubmitting: false,
          errorMessage: failure.errorMessage,
        ),
        (TransferEntity transfer) =>
            state.copyWith(isSubmitting: false, created: transfer),
      ),
    );
  }

  CreateTransferParams _params() {
    return CreateTransferParams(
      type: state.type!,
      toPartyId: state.toPartyId,
      clientUuid: state.clientUuid,
      occurredAt: DateTime.now(),
      notes: state.notes,
      items: state.items
          .map((DraftItem item) => item.params)
          .toList(growable: false),
    );
  }
}
