/**
 * The materialized-path arithmetic behind the category tree (`14`, option A).
 *
 * These are the same operations Postgres performs on the `ltree` column — `nlevel`, `subpath` and
 * the `<@` descendant test — expressed in TypeScript so the rules that decide whether a move is
 * legal can be settled before a transaction is opened, and tested without a database.
 */

export const PATH_SEPARATOR = '.';

/**
 * An LTREE label admits only alphanumerics and underscores, so the hyphens come out of the id.
 * Nothing else changes: the label is still the primary key, which is what keeps a path stable
 * when a category is renamed in either locale.
 */
export function toPathLabel(id: string): string {
  return id.replace(/-/g, '');
}

/** `parentPath` null (or empty) makes the node a root. */
export function buildPath(parentPath: string | null, id: string): string {
  const label = toPathLabel(id);
  return parentPath ? `${parentPath}${PATH_SEPARATOR}${label}` : label;
}

/** A root sits at depth 0, matching `nlevel(path) - 1`. */
export function depthOf(path: string): number {
  return labelsOf(path).length - 1;
}

/** The `<@` operator: true for the ancestor itself as well as everything under it. */
export function isSelfOrDescendant(path: string, ancestorPath: string): boolean {
  return path === ancestorPath || path.startsWith(`${ancestorPath}${PATH_SEPARATOR}`);
}

/**
 * Whether re-parenting the subtree at `categoryPath` under `newParentPath` would close a loop.
 *
 * A node moved under its own descendant would leave that branch unreachable from any root and
 * make every roll-up over it non-terminating, so this is refused outright rather than repaired.
 */
export function wouldCreateCycle(categoryPath: string, newParentPath: string | null): boolean {
  if (!newParentPath) return false;
  return isSelfOrDescendant(newParentPath, categoryPath);
}

/**
 * Where a node currently at `path` lands when the subtree rooted at `oldPath` is re-parented
 * under `newParentPath`. An empty `newParentPath` promotes the subtree to a root.
 */
export function rewriteDescendantPath(
  path: string,
  oldPath: string,
  newParentPath: string | null,
): string {
  const keepFrom = labelsOf(oldPath).length - 1;
  const tail = labelsOf(path).slice(keepFrom).join(PATH_SEPARATOR);

  return newParentPath ? `${newParentPath}${PATH_SEPARATOR}${tail}` : tail;
}

function labelsOf(path: string): string[] {
  return path.split(PATH_SEPARATOR);
}
