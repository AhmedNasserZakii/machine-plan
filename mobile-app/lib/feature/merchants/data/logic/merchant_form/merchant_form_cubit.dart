import 'dart:async';

import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/merchants/data/logic/merchant_form/merchant_form_state.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';
import 'package:machinery/feature/merchants/domain/params/merchant_form_params.dart';
import 'package:machinery/feature/merchants/domain/repos/merchants_repo.dart';

/// Backs both registration and edit. [existing] being null is what makes it a
/// registration — there is no separate mode flag to keep in sync.
class MerchantFormCubit extends Cubit<MerchantFormState> {
  MerchantFormCubit({required this.merchantsRepo, this.existing})
    : super(const MerchantFormReady());

  final MerchantsRepo merchantsRepo;
  final MerchantEntity? existing;

  /// Long enough that a phone typed at normal speed produces one request, not
  /// eleven.
  static const Duration checkDebounce = Duration(milliseconds: 500);

  static const int _egyptianMobileLength = 11;

  Timer? _checkTimer;

  bool get isEditing => existing != null;

  @override
  Future<void> close() {
    _checkTimer?.cancel();
    return super.close();
  }

  /// Runs while the representative is still typing. A complete phone is the
  /// trigger; anything shorter is not worth asking about, and an incomplete one
  /// would only produce a warning that clears itself a keystroke later.
  void checkDuplicates({required String phone, String? nationalId}) {
    _checkTimer?.cancel();

    final String trimmedPhone = phone.trim();
    final String? trimmedId = nationalId?.trim();

    if (trimmedPhone.length < _egyptianMobileLength) {
      _clearWarnings();
      return;
    }

    _checkTimer = Timer(checkDebounce, () async {
      final MerchantFormState current = state;
      if (current is! MerchantFormReady) {
        return;
      }

      emit(current.copyWith(isChecking: true));

      final Either<ServerFailure, MerchantDuplicateCheck> result =
          await merchantsRepo.checkDuplicates(
            params: CheckMerchantParams(
              phone: trimmedPhone,
              nationalId: (trimmedId?.isEmpty ?? true) ? null : trimmedId,
            ),
          );

      if (isClosed) {
        return;
      }

      final MerchantFormState settled = state;
      if (settled is! MerchantFormReady) {
        return;
      }

      result.fold(
        // The check is advisory. Failing it must not stop a registration the
        // server would have accepted.
        (ServerFailure _) => emit(settled.copyWith(isChecking: false)),
        (MerchantDuplicateCheck check) => emit(
          settled.copyWith(
            isChecking: false,
            warnings: check.warnings,
            duplicates: check.existing,
          ),
        ),
      );
    });
  }

  Future<void> submit({
    required String name,
    required String phone,
    required String shopName,
    required String address,
    String? nationalId,
    String? notes,
  }) async {
    final MerchantFormState current = state;
    if (current is! MerchantFormReady ||
        current.isSubmitting ||
        current.isBlocked) {
      return;
    }

    _checkTimer?.cancel();
    emit(
      current.copyWith(
        isSubmitting: true,
        fieldErrors: const <String, String>{},
      ),
    );

    final Either<ServerFailure, MerchantEntity> result = isEditing
        ? await merchantsRepo.updateMerchant(
            id: existing!.id,
            params: UpdateMerchantParams(
              name: name,
              phone: phone,
              shopName: shopName,
              address: address,
              nationalId: nationalId,
              notes: notes,
            ),
          )
        : await merchantsRepo.createMerchant(
            params: CreateMerchantParams(
              name: name,
              phone: phone,
              shopName: shopName,
              address: address,
              nationalId: nationalId,
              notes: notes,
            ),
          );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) {
        // Field-level problems belong under the fields. Anything else is a
        // one-off message, announced and then dropped so the form returns to an
        // editable state with the user's input intact.
        if (failure.fieldErrors.isNotEmpty) {
          emit(
            current.copyWith(
              isSubmitting: false,
              fieldErrors: failure.fieldErrors,
            ),
          );
          return;
        }

        emit(MerchantFormSubmitFailure(errorMessage: failure.errorMessage));
        emit(current.copyWith(isSubmitting: false));
      },
      (MerchantEntity merchant) => emit(
        MerchantFormSubmitted(merchant: merchant, wasCreated: !isEditing),
      ),
    );
  }

  void _clearWarnings() {
    final MerchantFormState current = state;
    if (current is! MerchantFormReady || current.warnings.isEmpty) {
      return;
    }

    emit(
      current.copyWith(
        isChecking: false,
        warnings: const <MerchantDuplicateWarning>[],
        duplicates: const <MerchantEntity>[],
      ),
    );
  }
}
