import { Locale } from 'src/common/constants/locales';
import {
  FinanceCategoryBreadcrumbResponse,
  FinanceCategoryResponse,
} from '../dto/responses/finance-category.response';
import { FinanceCategory } from '../entities/finance-category.entity';
import { categoryDescription, categoryName, CategoryTreeNode } from '../category-tree';

/** One node, without its children — the shape a list or a single read returns. */
export function toFinanceCategoryResponse(
  node: CategoryTreeNode,
  locale: Locale,
): FinanceCategoryResponse {
  const category = node.category;

  return {
    id: category.id,
    code: category.code,
    name: categoryName(category, locale),
    description: categoryDescription(category, locale),
    parentId: category.parentId,
    kind: category.kind,
    depth: category.depth,
    isSystem: category.isSystem,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
    transactionCount: node.transactionCount,
    totalAmount: node.directTotal,
    rolledUpTotal: node.rolledUpTotal,
  };
}

export function toFinanceCategoryTreeResponse(
  node: CategoryTreeNode,
  locale: Locale,
): FinanceCategoryResponse {
  return {
    ...toFinanceCategoryResponse(node, locale),
    children: node.children.map((child) => toFinanceCategoryTreeResponse(child, locale)),
  };
}

export function toBreadcrumbResponse(
  category: FinanceCategory,
  locale: Locale,
): FinanceCategoryBreadcrumbResponse {
  return {
    id: category.id,
    code: category.code,
    name: categoryName(category, locale),
    depth: category.depth,
  };
}
