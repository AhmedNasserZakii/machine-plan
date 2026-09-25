import 'package:dartz/dartz.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:machinery/core/network_services/api_service_failure.dart';
import 'package:machinery/feature/users/data/logic/branch_form/branch_form_state.dart';
import 'package:machinery/feature/users/domain/entities/branch_entity.dart';
import 'package:machinery/feature/users/domain/params/branch_form_params.dart';
import 'package:machinery/feature/users/domain/repos/users_repo.dart';

/// Create or edit a branch, and deactivate or restore an existing one.
/// [existing] null means create — there is no separate mode flag.
class BranchFormCubit extends Cubit<BranchFormState> {
  BranchFormCubit({required this.usersRepo, this.existing})
    : super(const BranchFormReady());

  final UsersRepo usersRepo;
  final BranchEntity? existing;

  bool get isEditing => existing != null;

  Future<void> submit({
    required String code,
    required String name,
    String? address,
    String? phone,
  }) async {
    final BranchFormState current = state;
    if (current is! BranchFormReady || current.isBusy) {
      return;
    }

    emit(
      current.copyWith(
        isSubmitting: true,
        fieldErrors: const <String, String>{},
      ),
    );

    final Either<ServerFailure, BranchEntity> result = isEditing
        ? await usersRepo.updateBranch(
            id: existing!.id,
            params: UpdateBranchParams(
              name: name,
              address: address,
              phone: phone,
            ),
          )
        : await usersRepo.createBranch(
            params: CreateBranchParams(
              code: code,
              name: name,
              address: address,
              phone: phone,
            ),
          );

    if (isClosed) {
      return;
    }

    result.fold(
      (ServerFailure failure) {
        if (failure.fieldErrors.isNotEmpty) {
          emit(
            current.copyWith(
              isSubmitting: false,
              fieldErrors: failure.fieldErrors,
            ),
          );
          return;
        }

        emit(BranchFormSubmitFailure(errorMessage: failure.errorMessage));
        emit(current.copyWith(isSubmitting: false));
      },
      (BranchEntity branch) =>
          emit(BranchFormSubmitted(branch: branch, wasCreated: !isEditing)),
    );
  }

  /// A 409 on deactivate means the branch still holds machines or active
  /// staff. The server's message says which, so it is shown as-is — there is
  /// deliberately no force option.
  Future<void> setActive({required bool isActive}) async {
    final BranchFormState current = state;
    final BranchEntity? existing = this.existing;
    if (current is! BranchFormReady || current.isBusy || existing == null) {
      return;
    }

    emit(current.copyWith(isTogglingActive: true));

    final Either<ServerFailure, BranchEntity> result = await usersRepo
        .setBranchActive(id: existing.id, isActive: isActive);

    if (isClosed) {
      return;
    }

    result.fold((ServerFailure failure) {
      emit(BranchFormSubmitFailure(errorMessage: failure.errorMessage));
      emit(current.copyWith(isTogglingActive: false));
    }, (BranchEntity branch) => emit(BranchFormActiveChanged(branch: branch)));
  }
}
