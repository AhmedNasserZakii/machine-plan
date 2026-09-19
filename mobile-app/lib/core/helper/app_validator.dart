import 'package:easy_localization/easy_localization.dart';
import 'package:machinery/core/constants/locale_keys.dart';

abstract class AppValidators {
  AppValidators._();

  /// Egyptian mobile numbers, with or without the country prefix.
  static final RegExp _egyptianPhone = RegExp(r'^(\+20|0)?1[0125]\d{8}$');

  /// Normalises any accepted Egyptian format to the canonical `01XXXXXXXXX`
  /// the backend expects.
  static String normalizeEgyptianPhone(String phoneNumber) {
    String digits = phoneNumber.trim().replaceAll(RegExp(r'[\s\-()]'), '');

    if (digits.startsWith('+20')) {
      digits = digits.substring(3);
    } else if (digits.startsWith('0020')) {
      digits = digits.substring(4);
    }

    if (!digits.startsWith('0')) {
      digits = '0$digits';
    }

    return digits;
  }

  static String? isValidEgyptianPhone(String? phoneNumber) {
    if (phoneNumber?.trim().isEmpty ?? true) {
      return LocaleKeys.thisFieldIsRequired.tr();
    }
    if (!_egyptianPhone.hasMatch(phoneNumber!.trim())) {
      return LocaleKeys.invalidPhoneNumber.tr();
    }
    return null;
  }

  static String? isValidPassword(String? password) {
    if (password?.isEmpty ?? true) {
      return LocaleKeys.thisFieldIsRequired.tr();
    }
    if ((password?.length ?? 0) < 8) {
      return LocaleKeys.passwordMinEight.tr();
    }
    return null;
  }

  static String? isValidConfirmPassword(
    String password,
    String? confirmPassword,
  ) {
    if (confirmPassword?.isEmpty ?? true) {
      return LocaleKeys.thisFieldIsRequired.tr();
    }
    if (confirmPassword != password) {
      return LocaleKeys.passwordNoCorrect.tr();
    }
    return null;
  }

  static String? isNotEmptyValidator(String? value) {
    if (value?.trim().isEmpty ?? true) {
      return LocaleKeys.thisFieldIsRequired.tr();
    }
    return null;
  }

  /// Lookup `code` — uppercase snake, length 2–60. Matches the backend rule
  /// on `CreateMachineModelDto` so a bad code never leaves the form.
  static String? isValidLookupCode(String? value) {
    final String trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) {
      return LocaleKeys.thisFieldIsRequired.tr();
    }
    if (!_lookupCode.hasMatch(trimmed)) {
      return LocaleKeys.machineModelCodeInvalid.tr();
    }
    return null;
  }

  static final RegExp _lookupCode = RegExp(r'^[A-Z][A-Z0-9_]{1,59}$');

  static String? isValidAmount(String? value) {
    if (value?.trim().isEmpty ?? true) {
      return LocaleKeys.thisFieldIsRequired.tr();
    }
    final num? parsed = num.tryParse(value!.trim());
    if (parsed == null) {
      return LocaleKeys.thisFieldIsNotValid.tr();
    }
    if (parsed <= 0) {
      return LocaleKeys.thisFieldIsNotMinusOrZero.tr();
    }
    return null;
  }

  static String? isValidSerial(String? serial) {
    if (serial?.trim().isEmpty ?? true) {
      return LocaleKeys.thisFieldIsRequired.tr();
    }
    if ((serial?.trim().length ?? 0) < 3) {
      return LocaleKeys.invalidSerialNumber.tr();
    }
    return null;
  }

  /// SIM serial. [isRequired] follows the machine type's `requiresSim`: a PIN
  /// pad has no mobile line, and the backend rejects a SIM serial for one.
  static String? isValidSimSerial(String? serial, {required bool isRequired}) {
    final String trimmed = serial?.trim() ?? '';

    if (trimmed.isEmpty) {
      return isRequired ? LocaleKeys.thisFieldIsRequired.tr() : null;
    }
    return _serialLength(trimmed);
  }

  /// Carton serial — always optional, since not every factory prints one.
  static String? isValidBoxSerial(String? serial) {
    final String trimmed = serial?.trim() ?? '';

    if (trimmed.isEmpty) {
      return null;
    }
    return _serialLength(trimmed);
  }

  /// Egyptian national ID — always optional on a merchant, since plenty of
  /// shopkeepers will not hand one over on the spot. When it is given the
  /// backend insists on exactly fourteen digits, so reject a short one here
  /// rather than round-trip a record that cannot be stored.
  static String? isValidNationalId(String? nationalId) {
    final String trimmed = nationalId?.trim() ?? '';

    if (trimmed.isEmpty) {
      return null;
    }
    if (!_nationalId.hasMatch(trimmed)) {
      return LocaleKeys.thisFieldIsNotValid.tr();
    }
    return null;
  }

  static final RegExp _nationalId = RegExp(r'^\d{14}$');

  /// The backend caps every serial at `VARCHAR(100)` with a 3-character floor,
  /// so reject locally rather than round-trip a value that cannot be stored.
  static String? _serialLength(String trimmed) {
    if (trimmed.length < 3 || trimmed.length > 100) {
      return LocaleKeys.invalidSerialNumber.tr();
    }
    return null;
  }
}
