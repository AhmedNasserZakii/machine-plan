/// What a continuous-mode scan turned into, decided by whoever is collecting
/// the scans (eligibility for a transfer type, "already added", etc.) — the
/// scanner itself has no opinion on either.
class ScanDecision {
  const ScanDecision.accept() : rejectionReason = null;

  const ScanDecision.reject(String reason) : rejectionReason = reason;

  /// Null when accepted.
  final String? rejectionReason;

  bool get isAccepted => rejectionReason == null;
}
