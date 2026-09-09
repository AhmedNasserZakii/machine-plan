import { Locale } from 'src/common/constants/locales';
import { pickTranslation } from 'src/common/utils';
import { FinanceTransactionResponse } from '../dto/responses/finance-transaction.response';
import { FinanceCategory } from '../entities/finance-category.entity';
import { FinanceTransaction } from '../entities/finance-transaction.entity';
import { categoryName, localizedCategoryPath } from '../category-tree';
import { isAutoPosted, isWithinEditWindow } from '../transaction-rules';

/**
 * Everything the mapper needs that is not on the row itself: the category index the localized
 * ancestry is read from, and the window that decides whether the app offers an edit button or
 * only a void.
 */
export interface TransactionView {
  locale: Locale;
  categoriesByLabel: Map<string, FinanceCategory>;
  editWindowDays: number;
  now: Date;
}

export function toFinanceTransactionResponse(
  transaction: FinanceTransaction,
  view: TransactionView,
): FinanceTransactionResponse {
  const auto = isAutoPosted(transaction.source);
  const category = transaction.category;

  return {
    id: transaction.id,
    referenceNo: transaction.referenceNo,
    kind: transaction.kind,
    amount: Number(transaction.amount),
    category: {
      id: category.id,
      code: category.code,
      name: categoryName(category, view.locale),
      path: localizedCategoryPath(category, view.categoriesByLabel, view.locale),
    },
    transactionDate: transaction.transactionDate,
    paymentMethod: {
      id: transaction.paymentMethodId,
      name:
        pickTranslation(transaction.paymentMethod?.translations, view.locale)?.name ??
        transaction.paymentMethod?.code ??
        '',
    },
    branch: transaction.branch
      ? { id: transaction.branch.id, name: transaction.branch.name }
      : null,
    supplier: transaction.supplier
      ? { id: transaction.supplier.id, name: transaction.supplier.name }
      : null,
    invoiceMediaId: transaction.invoiceMediaId,
    notes: transaction.notes,
    source: transaction.source,
    sourceRefType: transaction.sourceRefType,
    sourceRefId: transaction.sourceRefId,
    isVoided: transaction.isVoided,
    voidedAt: transaction.voidedAt?.toISOString() ?? null,
    voidReason: transaction.voidReason,
    // Both flags are sent so the app greys the buttons out rather than offering them and
    // collecting a 422 the user has to read.
    isEditable:
      !auto &&
      !transaction.isVoided &&
      isWithinEditWindow(transaction.createdAt, view.editWindowDays, view.now),
    isVoidable: !auto && !transaction.isVoided,
    createdAt: transaction.createdAt.toISOString(),
  };
}
