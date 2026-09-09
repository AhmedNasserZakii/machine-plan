import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FinanceKind, TransactionSource } from 'src/common/enums/finance.enum';
import { nextReferenceNo, ReferencePrefix } from 'src/common/utils';
import { FinanceTransaction } from '../entities/finance-transaction.entity';
import { toDateOnly } from '../transaction-rules';
import { BudgetsService } from './budgets.service';
import { FinanceCategoriesService, SystemCategoryCodeValue } from './finance-categories.service';

/**
 * What owns an auto-posted row. Paired with an id it is the row's identity, enforced by
 * `uq_ft_source_ref`, and it is the reason a replayed charge cannot double-count.
 */
export const FinanceSourceRefType = {
  VIOLATION: 'VIOLATION',
  SUBSCRIPTION_COLLECTION: 'SUBSCRIPTION_COLLECTION',
  MAINTENANCE_ORDER: 'MAINTENANCE_ORDER',
  MACHINE_INTAKE: 'MACHINE_INTAKE',
} as const;

export type FinanceSourceRefTypeValue =
  (typeof FinanceSourceRefType)[keyof typeof FinanceSourceRefType];

/** What an origin module knows about the money it just moved. */
export interface AutoPosting {
  kind: FinanceKind;
  amount: number;
  /** The seeded category the origin books against; resolved by code, never by id. */
  categoryCode: SystemCategoryCodeValue;
  transactionDate: Date | string;
  paymentMethodId: string;
  branchId: string | null;
  source: TransactionSource;
  sourceRefType: FinanceSourceRefTypeValue;
  /**
   * The origin record's identity. For a one-off event that is the record's own id; for a
   * repeatable one it has to be derived from the event, or the second collection on the same
   * plan would be swallowed as a duplicate of the first.
   */
  sourceRefId: string;
  notes?: string | null;
  /** Carried over when the origin holds the paperwork — a repair invoice, for instance (`11`). */
  supplierId?: string | null;
  invoiceMediaId?: string | null;
  actorId: string;
}

/**
 * The one way another module puts money in the ledger.
 *
 * Every caller passes its own `EntityManager`: an auto-posted row exists because something else
 * happened, and a charge that committed without its income row — or an income row without the
 * charge — is a reconciliation the accountant cannot win. Making the manager a required argument
 * is what stops that being an option.
 */
@Injectable()
export class FinancePostingService {
  constructor(
    private readonly categories: FinanceCategoriesService,
    private readonly budgets: BudgetsService,
  ) {}

  /**
   * Books the posting, or returns the row that already represents it.
   *
   * Idempotent on `(sourceRefType, sourceRefId)`. The pre-check keeps a replay off the error path;
   * `uq_ft_source_ref` is what actually holds when two requests race, and `ON CONFLICT DO NOTHING`
   * turns the loser into the same no-op as the pre-check rather than a failed origin operation.
   */
  async post(posting: AutoPosting, manager: EntityManager): Promise<FinanceTransaction> {
    const repository = manager.getRepository(FinanceTransaction);

    const existing = await repository.findOne({
      where: { sourceRefType: posting.sourceRefType, sourceRefId: posting.sourceRefId },
    });

    if (existing) return existing;

    const category = await this.categories.requireByCode(posting.categoryCode, manager);
    this.categories.assertKindMatches(category, posting.kind);

    const transactionDate =
      typeof posting.transactionDate === 'string'
        ? posting.transactionDate
        : toDateOnly(posting.transactionDate);

    const prefix =
      posting.kind === FinanceKind.EXPENSE ? ReferencePrefix.EXPENSE : ReferencePrefix.INCOME;

    const inserted = await repository
      .createQueryBuilder()
      .insert()
      .values({
        referenceNo: await nextReferenceNo(manager, prefix),
        kind: posting.kind,
        amount: String(posting.amount),
        categoryId: category.id,
        transactionDate,
        paymentMethodId: posting.paymentMethodId,
        branchId: posting.branchId,
        supplierId: posting.supplierId ?? null,
        invoiceMediaId: posting.invoiceMediaId ?? null,
        notes: posting.notes ?? null,
        source: posting.source,
        sourceRefType: posting.sourceRefType,
        sourceRefId: posting.sourceRefId,
        isVoided: false,
        createdBy: posting.actorId,
      })
      .orIgnore()
      .returning('id')
      .execute();

    const id = (inserted.raw as Array<{ id: string }>)[0]?.id;

    if (id === undefined) {
      return repository.findOneByOrFail({
        sourceRefType: posting.sourceRefType,
        sourceRefId: posting.sourceRefId,
      });
    }

    if (posting.kind === FinanceKind.EXPENSE) {
      await this.budgets.evaluateAfterWrite(
        {
          categoryId: category.id,
          categoryPath: category.path,
          branchId: posting.branchId,
          transactionDate,
        },
        manager,
      );
    }

    return repository.findOneByOrFail({ id });
  }
}
