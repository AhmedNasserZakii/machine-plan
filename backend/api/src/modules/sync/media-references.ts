const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `mediaId`, `signatureMediaId`, `invoiceMediaId` — the naming convention every payload follows. */
function isMediaField(key: string): boolean {
  return key === 'mediaId' || key.endsWith('MediaId');
}

/** `photoMediaIds` — the plural form, carrying bare ids rather than objects. */
function isMediaListField(key: string): boolean {
  return key.endsWith('MediaIds');
}

/**
 * Every media id an offline payload points at, at any depth — transfer item photos sit inside an
 * array of items, in an array of their own.
 *
 * A queued operation references its evidence by the `clientUuid` the device assigned when the
 * photo was taken, because the real id did not exist yet (`20`, media in offline mode).
 */
export function collectMediaReferences(payload: unknown): string[] {
  const found = new Set<string>();
  walk(payload, (value) => found.add(value));
  return [...found];
}

/**
 * Rewrites the device's ids to the server's. Anything absent from the map is left alone: it is
 * either a real media id the device learned from an earlier upload, or one that has not arrived
 * yet — and in that case the operation's own media check is what reports it, with the id the
 * client sent, rather than this function inventing a diagnosis.
 */
export function resolveMediaReferences<T>(payload: T, resolved: Map<string, string>): T {
  return rewrite(payload, resolved) as T;
}

function walk(value: unknown, visit: (id: string) => void): void {
  if (Array.isArray(value)) {
    for (const entry of value) walk(entry, visit);
    return;
  }

  if (value === null || typeof value !== 'object') return;

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isMediaField(key)) {
      if (isId(entry)) visit(entry);
      continue;
    }

    if (isMediaListField(key) && Array.isArray(entry)) {
      for (const id of entry) if (isId(id)) visit(id);
      continue;
    }

    walk(entry, visit);
  }
}

function rewrite(value: unknown, resolved: Map<string, string>): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => rewrite(entry, resolved));
  }

  if (value === null || typeof value !== 'object') return value;

  const output: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isMediaField(key)) {
      output[key] = typeof entry === 'string' ? (resolved.get(entry) ?? entry) : entry;
      continue;
    }

    if (isMediaListField(key) && Array.isArray(entry)) {
      output[key] = (entry as unknown[]).map((id) =>
        typeof id === 'string' ? (resolved.get(id) ?? id) : id,
      );
      continue;
    }

    output[key] = rewrite(entry, resolved);
  }

  return output;
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
