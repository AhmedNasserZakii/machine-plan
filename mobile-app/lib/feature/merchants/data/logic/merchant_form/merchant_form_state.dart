import 'package:equatable/equatable.dart';
import 'package:machinery/core/utils/enums.dart';
import 'package:machinery/feature/merchants/domain/entities/merchant_entity.dart';

sealed class MerchantFormState extends Equatable {
  const MerchantFormState();

  @override
  List<Object?> get props => <Object?>[];
}

class MerchantFormReady extends MerchantFormState {
  const MerchantFormReady({
    this.isSubmitting = false,
    this.isChecking = false,
    this.warnings = const <MerchantDuplicateWarning>[],
    this.duplicates = const <MerchantEntity>[],
    this.fieldErrors = const <String, String>{},
  });

  final bool isSubmitting;

  /// The duplicate pre-flight, which runs on its own while the form stays
  /// editable — the representative should never wait on it.
  final bool isChecking;

  final List<MerchantDuplicateWarning> warnings;

  /// The shops that already carry this phone, shown so the representative can
  /// recognise one rather than being told a number is taken.
  final List<MerchantEntity> duplicates;

  final Map<String, String> fieldErrors;

  /// A repeated national ID is refused by the server, so the form refuses it
  /// first rather than collecting a full record and then losing it.
  bool get isBlocked =>
      warnings.contains(MerchantDuplicateWarning.duplicateNationalId);

  bool get hasPhoneWarning =>
      warnings.contains(MerchantDuplicateWarning.duplicatePhone);

  MerchantFormReady copyWith({
    bool? isSubmitting,
    bool? isChecking,
    List<MerchantDuplicateWarning>? warnings,
    List<MerchantEntity>? duplicates,
    Map<String, String>? fieldErrors,
  }) {
    return MerchantFormReady(
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isChecking: isChecking ?? this.isChecking,
      warnings: warnings ?? this.warnings,
      duplicates: duplicates ?? this.duplicates,
      fieldErrors: fieldErrors ?? this.fieldErrors,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    isSubmitting,
    isChecking,
    warnings,
    duplicates,
    fieldErrors,
  ];
}

class MerchantFormSubmitted extends MerchantFormState {
  const MerchantFormSubmitted({
    required this.merchant,
    required this.wasCreated,
  });

  final MerchantEntity merchant;
  final bool wasCreated;

  @override
  List<Object?> get props => <Object?>[merchant, wasCreated];
}

/// Announced and then dropped, so the form returns to an editable state with
/// the user's input intact.
class MerchantFormSubmitFailure extends MerchantFormState {
  const MerchantFormSubmitFailure({required this.errorMessage});

  final String errorMessage;

  @override
  List<Object?> get props => <Object?>[errorMessage];
}
