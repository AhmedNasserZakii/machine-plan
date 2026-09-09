/**
 * Builds a safe `ILIKE` pattern from user input.
 *
 * Queries are parameterized, so this is not about SQL injection — it is that `%` and `_`
 * are wildcards *inside* the parameter. A search for `%` would otherwise match every row
 * and a pattern full of `_` forces the planner into an expensive scan. Escaping them means
 * a user searching for a literal underscore finds an underscore.
 *
 * Uses the SQL standard `ESCAPE '\'` semantics, which Postgres applies to LIKE/ILIKE by
 * default.
 */
export function likePattern(search: string): string {
  return `%${escapeLikeWildcards(search.trim())}%`;
}

export function escapeLikeWildcards(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
