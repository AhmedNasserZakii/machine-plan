import { stableStringify } from '../utils/hash.util';
import { redact } from './redaction';

export interface AuditSnapshot {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

/**
 * Reduces two full-entity snapshots to only the keys that actually changed (`21`: "store only
 * the changed keys, not the whole entity"), then redacts both sides.
 *
 * - `before` is `null`: nothing to compare against — a creation. `after` is returned whole
 *   (redacted), `before` stays `null`.
 * - `after` is `null`: the entity is gone — a deletion. `before` is returned whole (redacted) so
 *   the log still shows what existed, `after` stays `null`.
 * - Both given: a top-level key is kept on both sides whenever its value differs, compared by
 *   stable-stringified equality so nested objects/arrays and key order do not cause false
 *   positives. A key present on only one side counts as changed. Values are compared as given —
 *   this is a top-level diff, not a recursive one, matching the plan's own example.
 */
export function diffSnapshots(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): AuditSnapshot {
  if (!before) return { before: null, after: after ? redact(after) : null };
  if (!after) return { before: redact(before), after: null };

  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (stableStringify(before[key]) === stableStringify(after[key])) continue;

    if (key in before) changedBefore[key] = before[key];
    if (key in after) changedAfter[key] = after[key];
  }

  return {
    before: Object.keys(changedBefore).length ? redact(changedBefore) : null,
    after: Object.keys(changedAfter).length ? redact(changedAfter) : null,
  };
}
