/**
 * Dotted numeric version compare (`X-Client-Version`/`MIN_CLIENT_VERSION`, both plain
 * `major.minor.patch`-shaped strings — no pre-release/build-metadata suffixes to worry about,
 * unlike full semver). Returns `null` for anything that doesn't parse as one or more
 * non-negative integers separated by dots, so a caller can fail open on garbage input.
 */
export function parseVersion(raw: string): number[] | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d+)*$/.test(trimmed)) return null;

  return trimmed.split('.').map(Number);
}

/** `true` only when both parse and `current` is strictly below `minimum`, segment by segment. */
export function isVersionBelow(current: string, minimum: string): boolean {
  const currentParts = parseVersion(current);
  const minimumParts = parseVersion(minimum);
  if (!currentParts || !minimumParts) return false;

  const length = Math.max(currentParts.length, minimumParts.length);
  for (let i = 0; i < length; i += 1) {
    const currentSegment = currentParts[i] ?? 0;
    const minimumSegment = minimumParts[i] ?? 0;
    if (currentSegment !== minimumSegment) return currentSegment < minimumSegment;
  }

  return false;
}
