import type { FinanceCategory, FinanceKind } from '../model';
import { asText } from './value';

export type FlatCategory = {
  id: string;
  name: string;
  kind: FinanceKind;
  depth: number;
  parentId: string | null;
  isSystem: boolean;
  isActive: boolean;
  transactionCount: number;
  totalAmount: number;
  rolledUpTotal: number;
  hasChildren: boolean;
  pathLabel: string;
};

export function flattenCategories(
  nodes: FinanceCategory[],
  parentPath = '',
  acc: FlatCategory[] = [],
): FlatCategory[] {
  for (const node of nodes) {
    const name = node.name;
    const pathLabel = parentPath ? `${parentPath} / ${name}` : name;
    const children = node.children ?? [];
    acc.push({
      id: node.id,
      name,
      kind: node.kind,
      depth: node.depth,
      parentId: asText(node.parentId),
      isSystem: node.isSystem,
      isActive: node.isActive,
      transactionCount: node.transactionCount,
      totalAmount: node.totalAmount,
      rolledUpTotal: node.rolledUpTotal,
      hasChildren: children.length > 0,
      pathLabel,
    });
    if (children.length) flattenCategories(children, pathLabel, acc);
  }
  return acc;
}

export function findCategory(nodes: FinanceCategory[], id: string): FinanceCategory | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const kids = node.children ?? [];
    if (kids.length) {
      const found = findCategory(kids, id);
      if (found) return found;
    }
  }
  return null;
}

export function leafCategories(nodes: FinanceCategory[], kind?: FinanceKind): FlatCategory[] {
  return flattenCategories(nodes).filter(
    (row) => !row.hasChildren && row.isActive && (!kind || row.kind === kind),
  );
}

export function sourceOriginHref(
  sourceRefType: string | null | undefined,
  sourceRefId: string | null | undefined,
): string | null {
  const type = asText(sourceRefType);
  const id = asText(sourceRefId);
  if (!type || !id) return null;
  if (type === 'MAINTENANCE_ORDER') return `/maintenance/${id}`;
  if (type === 'VIOLATION') return `/violations/${id}`;
  if (type === 'SUBSCRIPTION_COLLECTION') return `/merchants`;
  return null;
}
