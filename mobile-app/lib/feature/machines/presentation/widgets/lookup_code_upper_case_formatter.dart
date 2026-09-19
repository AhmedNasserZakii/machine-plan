import 'package:flutter/services.dart';

/// Forces UPPER_SNAKE_CASE as the user types — the server rejects anything else.
class LookupCodeUpperCaseFormatter extends TextInputFormatter {
  const LookupCodeUpperCaseFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return newValue.copyWith(text: newValue.text.toUpperCase());
  }
}
