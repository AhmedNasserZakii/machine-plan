class ReplacementFormErrors {
  const ReplacementFormErrors({
    this.newSerial,
    this.newBatterySerial,
    this.newSimSerial,
    this.reason,
    this.warranty,
  });

  final String? newSerial;
  final String? newBatterySerial;
  final String? newSimSerial;
  final String? reason;
  final String? warranty;

  bool get isValid =>
      newSerial == null &&
      newBatterySerial == null &&
      newSimSerial == null &&
      reason == null &&
      warranty == null;
}

/// Structural rules that can be checked without a network call. Database-wide
/// duplicate checks remain authoritative on the server and are surfaced by
/// the Cubit without discarding what the user typed.
ReplacementFormErrors validateReplacementForm({
  required String oldSerial,
  required String? oldBatterySerial,
  required String? oldSimSerial,
  required String newSerial,
  required String newBatterySerial,
  required String? newSimSerial,
  required bool requiresSim,
  required String reason,
  required String? warrantyStart,
  required String? warrantyEnd,
  required String requiredMessage,
  required String tooShortMessage,
  required String mustBeDifferentMessage,
  required String warrantyOrderMessage,
}) {
  String? serialError(String value, String? oldValue, {bool required = true}) {
    final String normalized = value.trim();
    if (required && normalized.isEmpty) return requiredMessage;
    if (normalized.isNotEmpty && normalized.length < 3) return tooShortMessage;
    if (oldValue != null &&
        normalized.isNotEmpty &&
        normalized.toLowerCase() == oldValue.trim().toLowerCase()) {
      return mustBeDifferentMessage;
    }
    return null;
  }

  String? warrantyError;
  final DateTime? start = DateTime.tryParse(warrantyStart ?? '');
  final DateTime? end = DateTime.tryParse(warrantyEnd ?? '');
  if (start != null && end != null && end.isBefore(start)) {
    warrantyError = warrantyOrderMessage;
  }

  final String trimmedReason = reason.trim();
  return ReplacementFormErrors(
    newSerial: serialError(newSerial, oldSerial),
    newBatterySerial: serialError(newBatterySerial, oldBatterySerial),
    newSimSerial: requiresSim
        ? serialError(newSimSerial ?? '', oldSimSerial)
        : null,
    reason: trimmedReason.isEmpty
        ? requiredMessage
        : (trimmedReason.length < 5 ? tooShortMessage : null),
    warranty: warrantyError,
  );
}
