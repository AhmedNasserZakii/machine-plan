import { Locale } from 'src/common/constants/locales';
import { round } from '../budget-rules';
import { categoryName, CategoryTreeNode } from '../category-tree';
import {
  CategoryBudgetRefResponse,
  FinanceByCategoryNodeResponse,
} from '../dto/responses/finance-report.response';

export interface ByCategoryContext {
  locale: Locale;
  grandTotal: number;
  /** The parent's rolled-up figure, or null on a root — which has nothing to be a share of. */
  parentTotal: number | null;
  budgetOf: (node: CategoryTreeNode) => CategoryBudgetRefResponse | null;
}

/**
 * Both totals are always sent (`14`): a parent showing only its own direct spend confuses people,
 * and one showing only the roll-up hides where the money actually went.
 */
export function toByCategoryNodeResponse(
  node: CategoryTreeNode,
  context: ByCategoryContext,
): FinanceByCategoryNodeResponse {
  const { category } = node;

  return {
    id: category.id,
    code: category.code,
    name: categoryName(category, context.locale),
    depth: category.depth,
    directTotal: node.directTotal,
    rolledUpTotal: node.rolledUpTotal,
    transactionCount: node.transactionCount,
    rolledUpCount: node.rolledUpCount,
    percentOfGrandTotal: share(node.rolledUpTotal, context.grandTotal) ?? 0,
    percentOfParent: share(node.rolledUpTotal, context.parentTotal),
    budget: context.budgetOf(node),
    children: node.children.map((child) =>
      toByCategoryNodeResponse(child, { ...context, parentTotal: node.rolledUpTotal }),
    ),
  };
}

function share(part: number, whole: number | null): number | null {
  if (whole === null || whole === 0) return null;

  return round((part / whole) * 100, 1);
}
