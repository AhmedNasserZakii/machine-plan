/**
 * The shape of everything `GET /sync/bootstrap` and `GET /sync/delta` return.
 *
 * A client whose stored version is older than this must re-bootstrap rather than ask for a delta
 * (`20`, schema versioning): a delta only carries rows that changed, so it can never repair a
 * local table whose columns no longer match.
 *
 * **Bump this whenever a synced collection gains, loses or renames a field** — not when a row
 * changes. Version 2 added `truncated` on bootstrap and `hasMore` on delta.
 */
export const SYNC_SCHEMA_VERSION = 2;
