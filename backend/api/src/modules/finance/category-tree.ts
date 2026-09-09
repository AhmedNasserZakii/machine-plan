import { Locale } from 'src/common/constants/locales';
import { pickTranslation } from 'src/common/utils';
import { FinanceCategory } from './entities/finance-category.entity';
import { isSelfOrDescendant, toPathLabel } from './category-path';

/** What one grouped-by-category aggregate row carries. */
export interface CategoryAggregate {
  total: number;
  count: number;
}

export interface CategoryTreeNode {
  category: FinanceCategory;
  /** Booked on this exact node. */
  directTotal: number;
  transactionCount: number;
  /** This node plus every descendant — including ones pruned from `children` for display. */
  rolledUpTotal: number;
  rolledUpCount: number;
  children: CategoryTreeNode[];
}

/**
 * Assembles the flat category rows into a forest and rolls the totals up in one post-order pass.
 *
 * Anything whose parent is absent from `categories` becomes a root here, which is what makes
 * reporting on a subtree a matter of filtering the input rather than a second traversal.
 */
export function assembleCategoryTree(
  categories: FinanceCategory[],
  aggregates: Map<string, CategoryAggregate>,
): CategoryTreeNode[] {
  const nodes = new Map<string, CategoryTreeNode>();

  for (const category of categories) {
    const aggregate = aggregates.get(category.id);

    nodes.set(category.id, {
      category,
      directTotal: aggregate?.total ?? 0,
      transactionCount: aggregate?.count ?? 0,
      rolledUpTotal: 0,
      rolledUpCount: 0,
      children: [],
    });
  }

  const roots: CategoryTreeNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.category.parentId ? nodes.get(node.category.parentId) : undefined;

    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  for (const node of nodes.values()) node.children.sort(compareCategories);
  roots.sort(compareCategories);

  for (const root of roots) rollUp(root);

  return roots;
}

/**
 * Keeps only the nodes the caller wants rendered, dropping a rejected node's whole subtree.
 *
 * Run after the roll-up on purpose: a deactivated category still holds history, so its spend has
 * to remain inside its ancestors' totals even once it is hidden from the screen (`14`, rule 3).
 */
export function pruneCategoryTree(
  nodes: CategoryTreeNode[],
  keep: (node: CategoryTreeNode) => boolean,
): CategoryTreeNode[] {
  return nodes.filter(keep).map((node) => ({
    ...node,
    children: pruneCategoryTree(node.children, keep),
  }));
}

/** `maxDepth` counts levels below the returned roots, so 0 is the roots on their own. */
export function limitTreeDepth(nodes: CategoryTreeNode[], maxDepth: number): CategoryTreeNode[] {
  if (maxDepth <= 0) return nodes.map((node) => ({ ...node, children: [] }));

  return nodes.map((node) => ({
    ...node,
    children: limitTreeDepth(node.children, maxDepth - 1),
  }));
}

export function flattenCategoryTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategoryTree(node.children)]);
}

/** The rows of `categories` that sit at or under `root`, ready to be assembled on their own. */
export function subtreeRows(
  categories: FinanceCategory[],
  root: FinanceCategory,
): FinanceCategory[] {
  return categories.filter((category) => isSelfOrDescendant(category.path, root.path));
}

export function categoryName(category: FinanceCategory, locale: Locale): string {
  return pickTranslation(category.translations, locale)?.name ?? category.code ?? '';
}

export function categoryDescription(category: FinanceCategory, locale: Locale): string | null {
  return pickTranslation(category.translations, locale)?.description ?? null;
}

/**
 * `مصاريف تشغيل / صيانة / قطع غيار` — the localized ancestry, read straight off the materialized
 * path so a transaction row makes sense on its own without a second call to fetch its parents.
 */
export function localizedCategoryPath(
  category: FinanceCategory,
  byLabel: Map<string, FinanceCategory>,
  locale: Locale,
): string {
  return category.path
    .split('.')
    .map((label) => byLabel.get(label))
    .filter((ancestor): ancestor is FinanceCategory => ancestor !== undefined)
    .map((ancestor) => categoryName(ancestor, locale))
    .join(' / ');
}

export function indexByPathLabel(categories: FinanceCategory[]): Map<string, FinanceCategory> {
  return new Map(categories.map((category) => [toPathLabel(category.id), category]));
}

function rollUp(node: CategoryTreeNode): void {
  let total = node.directTotal;
  let count = node.transactionCount;

  for (const child of node.children) {
    rollUp(child);
    total += child.rolledUpTotal;
    count += child.rolledUpCount;
  }

  node.rolledUpTotal = round2(total);
  node.rolledUpCount = count;
}

/** `sort_order` drives picker order; the localized name is unavailable here, so id breaks ties. */
function compareCategories(first: CategoryTreeNode, second: CategoryTreeNode): number {
  if (first.category.sortOrder !== second.category.sortOrder) {
    return first.category.sortOrder - second.category.sortOrder;
  }

  return first.category.id.localeCompare(second.category.id);
}

/** Money is summed as floats here, so the accumulated pennies are trimmed at each level. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
