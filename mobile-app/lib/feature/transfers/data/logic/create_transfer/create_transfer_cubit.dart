import 'dart:async';
import 'dart:typed_data';

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

  Timer? _recipientsSearchTimer;

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

  Future<void> loadRecipients({String? search, bool showLoader = true}) async {
    final CreatableTransferType? option = state.selected;
    if (option == null) return;

    final String? trimmed = search?.trim();
    final String? query = (trimmed == null || trimmed.isEmpty) ? null : trimmed;

    emit(
      state.copyWith(
        isLoadingRecipients: showLoader,
        recipientsSearch: query,
        recipientsPage: 1,
        resetRecipientsSearch: true,
        clearError: true,
      ),
    );

    final Either<ServerFailure, TransferRecipientsPage> result =
        await transfersRepo.fetchRecipients(type: option.type, search: query);

    if (isClosed) return;

    emit(
      result.fold(
        (ServerFailure failure) => state.copyWith(
          isLoadingRecipients: false,
          errorMessage: failure.errorMessage,
        ),
        (TransferRecipientsPage page) => state.copyWith(
          isLoadingRecipients: false,
          recipients: page.recipients,
          recipientsHasNext: page.meta.hasNext,
          recipientsPage: 1,
          recipientsSearch: query,
          resetRecipientsSearch: true,
        ),
      ),
    );
  }

  Future<void> loadMoreRecipients() async {
    final CreatableTransferType? option = state.selected;
    if (option == null ||
        state.isLoadingMoreRecipients ||
        !state.recipientsHasNext) {
      return;
    }

    emit(state.copyWith(isLoadingMoreRecipients: true));

    final int nextPage = state.recipientsPage + 1;
    final Either<ServerFailure, TransferRecipientsPage> result =
        await transfersRepo.fetchRecipients(
      type: option.type,
      page: nextPage,
      search: state.recipientsSearch,
    );

    if (isClosed) return;

    emit(
      result.fold(
        (ServerFailure _) => state.copyWith(isLoadingMoreRecipients: false),
        (TransferRecipientsPage page) => state.copyWith(
          isLoadingMoreRecipients: false,
          recipients: <TransferRecipient>[
            ...state.recipients,
            ...page.recipients,
          ],
          recipientsHasNext: page.meta.hasNext,
          recipientsPage: nextPage,
        ),
      ),
    );
  }

  void searchRecipients(String term) {
    _recipientsSearchTimer?.cancel();
    _recipientsSearchTimer = Timer(const Duration(milliseconds: 350), () {
      loadRecipients(search: term, showLoader: false);
    });
  }

  @override
  Future<void> close() {
    _recipientsSearchTimer?.cancel();
    return super.close();
  }

  void selectRecipient(TransferRecipient recipient) => emit(
    state.copyWith(
      recipientId: recipient.id,
      selectedRecipient: recipient,
      clearError: true,
    ),
  );

  /// [name] is the shop name for a merchant picked via "تاجر جديد" — a bare
  /// typed id carries none, and the signing screen falls back to showing the
  /// id itself rather than a blank recipient.
  void setMerchantId(String? id, {String? name}) {
    final String? trimmed = id?.trim();

    emit(
      trimmed == null || trimmed.isEmpty
          ? state.copyWith(clearRecipient: true)
          : state.copyWith(
              merchantId: trimmed,
              merchantName: name,
              resetMerchantName: true,
              clearError: true,
            ),
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

  /// With twenty identical machines, tapping charger/box/condition on each one
  /// is punishing — this broadcasts one item's declaration to every other item
  /// in the draft in a single step.
  void applyToAll({
    required bool hasCharger,
    required bool hasBox,
    required ItemCondition condition,
  }) {
    emit(
      state.copyWith(
        items: state.items
            .map(
              (DraftItem item) => item.copyWith(
                params: item.params.copyWith(
                  hasCharger: hasCharger,
                  hasBox: hasBox,
                  condition: condition,
                ),
              ),
            )
            .toList(growable: false),
        clearError: true,
      ),
    );
  }

  /// Uploads (or, offline, stages) one already-compressed photo and appends
  /// its id to the item's list. Returns the id so the caller can keep the
  /// in-memory bytes keyed by it for an immediate thumbnail — there is no
  /// server URL to preview from until the transfer itself is fetched back.
  Future<String?> addPhoto(String machineId, Uint8List jpeg) async {
    final Either<ServerFailure, String> result = await transfersRepo
        .uploadItemPhoto(jpeg: jpeg);

    if (isClosed) return null;

    return result.fold((ServerFailure failure) {
      emit(state.copyWith(errorMessage: failure.errorMessage));
      return null;
    }, (String mediaId) {
      final DraftItem item = state.items.firstWhere(
        (DraftItem draftItem) => draftItem.machine.id == machineId,
      );
      updateItem(
        machineId,
        photoMediaIds: <String>[...item.params.photoMediaIds, mediaId],
      );
      return mediaId;
    });
  }

  void removePhoto(String machineId, String mediaId) {
    final DraftItem item = state.items.firstWhere(
      (DraftItem draftItem) => draftItem.machine.id == machineId,
    );
    updateItem(
      machineId,
      photoMediaIds: item.params.photoMediaIds
          .where((String id) => id != mediaId)
          .toList(growable: false),
    );
  }

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

  /// The plain path: every type except a self-attested one (`needsSenderSignature
  /// == false`) submits with no signature at all — the receiver signs on
  /// `confirm` (`9.4`), and the server never asked this call for one.
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

  /// The self-attested path: a merchant, the factory, and the scrapyard have
  /// no account to receive a pending hand-off and confirm it later, so the
  /// sender's own signature closes the document in this same call
  /// (`transfers.service.ts`, `rule.autoConfirm`). A drawn signature uploads
  /// its PNG first — the two are one action from the user's point of view, so
  /// a failed upload must not leave the button looking ready. A biometric one
  /// carries no media: [biometricSignature] already has everything the
  /// server needs, verified on this device before this method was called.
  Future<void> submitWithSignature({
    Uint8List? signaturePng,
    SignatureParams? biometricSignature,
    String? deviceModel,
  }) async {
    assert(
      signaturePng != null || biometricSignature != null,
      'submitWithSignature needs either a drawn signature or a verified biometric one',
    );
    if (state.isSubmitting) return;

    emit(state.copyWith(isSubmitting: true, clearError: true));

    final SignatureParams? signature;
    if (biometricSignature != null) {
      signature = biometricSignature;
    } else {
      final Either<ServerFailure, String> upload = await transfersRepo
          .uploadSignature(png: signaturePng!);

      if (isClosed) return;

      final String? mediaId = upload.fold((ServerFailure failure) {
        emit(
          state.copyWith(
            isSubmitting: false,
            errorMessage: failure.errorMessage,
          ),
        );
        return null;
      }, (String id) => id);

      if (mediaId == null) return;

      signature = SignatureParams(
        method: SignatureMethod.drawn,
        signatureMediaId: mediaId,
        deviceModel: deviceModel,
      );
    }

    final Either<ServerFailure, TransferEntity> result = await transfersRepo
        .createTransfer(params: _params(senderSignature: signature));

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

  CreateTransferParams _params({SignatureParams? senderSignature}) {
    return CreateTransferParams(
      type: state.type!,
      toPartyId: state.toPartyId,
      clientUuid: state.clientUuid,
      occurredAt: DateTime.now(),
      senderSignature: senderSignature,
      notes: state.notes,
      items: state.items
          .map((DraftItem item) => item.params)
          .toList(growable: false),
    );
  }
}
