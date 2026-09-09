import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { Locale } from 'src/common/constants/locales';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import { FinanceKind } from 'src/common/enums/finance.enum';
import { MediaPurpose } from 'src/common/enums/operations.enum';
import { AppException } from 'src/common/errors';
import { ExportColumn, ExportTable, toCsv, toXlsx } from 'src/common/export';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import {
  joinTranslation,
  likePattern,
  nextReferenceNo,
  pickTranslation,
  ReferencePrefix,
} from 'src/common/utils';
import { BusinessConfig } from 'src/config/business.config';
import { PaymentMethod } from 'src/modules/lookups/entities/payment-method.entity';
import { MediaService } from 'src/modules/media/media.service';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { User } from 'src/modules/users/entities/user.entity';
import {
  CreateFinanceTransactionDto,
  ExportFinanceTransactionsDto,
  QueryFinanceTransactionsDto,
  UpdateFinanceTransactionDto,
  VoidFinanceTransactionDto,
} from '../dto/finance-transaction.dto';
import { FinanceCategory } from '../entities/finance-category.entity';
import { FinanceTransaction } from '../entities/finance-transaction.entity';
import { Supplier } from '../entities/supplier.entity';
import { indexByPathLabel, localizedCategoryPath } from '../category-tree';
import { TransactionView } from '../mappers/finance-transaction.mapper';
import {
  backdateDays,
  isAutoPosted,
  isFutureDate,
  isWithinEditWindow,
  toDateOnly,
} from '../transaction-rules';
import { BudgetsService } from './budgets.service';
import { FinanceCategoriesService } from './finance-categories.service';

/** One row and the context its response needs, so a handler makes a single service call. */
export interface TransactionResult {
  transaction: FinanceTransaction;
  view: TransactionView;
}

export interface TransactionPageResult {
  page: PaginatedResult<FinanceTransaction>;
  view: TransactionView;
}

export interface FinanceExport {
  filename: string;
  mimeType: string;
  body: Buffer;
}

/**
 * An export is the whole selection or it is useless, so it is not paginated — but it still runs
 * on a request thread, and this is what keeps a filterless call from streaming the entire ledger.
 */
const EXPORT_MAX_ROWS = 20000;

/**
 * The ledger columns, headed with the machine-readable names the accountants' own spreadsheets
 * already key on. Unlike the `17` reports these are not translated: this file is re-imported
 * elsewhere, and a header that changes with `Accept-Language` breaks whatever reads it.
 */
const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'reference_no', header: 'reference_no', type: 'text' },
  { key: 'transaction_date', header: 'transaction_date', type: 'date' },
  { key: 'kind', header: 'kind', type: 'text' },
  { key: 'category', header: 'category', type: 'text' },
  { key: 'amount', header: 'amount', type: 'number' },
  { key: 'payment_method', header: 'payment_method', type: 'text' },
  { key: 'supplier', header: 'supplier', type: 'text' },
  { key: 'branch', header: 'branch', type: 'text' },
  { key: 'source', header: 'source', type: 'text' },
  { key: 'is_voided', header: 'is_voided', type: 'text' },
  { key: 'notes', header: 'notes', type: 'text' },
  { key: 'created_by', header: 'created_by', type: 'text' },
  { key: 'created_at', header: 'created_at', type: 'text' },
];

@Injectable()
export class FinanceTransactionsService {
  private readonly business: BusinessConfig;

  constructor(
    @InjectRepository(FinanceTransaction)
    private readonly transactions: Repository<FinanceTransaction>,
    private readonly categories: FinanceCategoriesService,
    private readonly budgets: BudgetsService,
    private readonly media: MediaService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.business = config.getOrThrow<BusinessConfig>('business');
  }

  async findAll(
    query: QueryFinanceTransactionsDto,
    scope: BranchScope,
    locale: Locale,
  ): Promise<TransactionPageResult> {
    const qb = this.baseQuery(locale);

    this.applyScope(qb, scope);
    await this.applyFilters(qb, query, scope);

    qb.orderBy(`transaction.${query.sortBy}`, query.order).addOrderBy('transaction.id', 'ASC');
    qb.skip(query.skip).take(query.take);

    const [rows, total] = await qb.getManyAndCount();

    return {
      page: new PaginatedResult(rows, total, query.page, query.limit),
      view: await this.view(locale),
    };
  }

  async findById(id: string, scope: BranchScope, locale: Locale): Promise<TransactionResult> {
    return {
      transaction: await this.requireVisible(id, scope, locale),
      view: await this.view(locale),
    };
  }

  /**
   * A manual entry. Everything that could make the row a lie is checked before the insert: its
   * category's kind, its date, and the branch the caller is allowed to book against.
   */
  async create(
    dto: CreateFinanceTransactionDto,
    scope: BranchScope,
    actor: AuthUser,
    locale: Locale,
  ): Promise<TransactionResult> {
    if (dto.clientUuid) {
      const replayed = await this.transactions.findOne({
        where: { clientUuid: dto.clientUuid },
      });

      // The field exists for a submit sent twice off a flaky connection; returning the row it
      // already created is the whole point, so this is not a conflict.
      if (replayed) return this.findById(replayed.id, scope, locale);
    }

    const category = await this.categories.requireById(dto.categoryId);
    this.categories.assertKindMatches(category, dto.kind);

    this.assertDateAllowed(dto.transactionDate, actor);
    await this.assertPaymentMethod(dto.paymentMethodId);

    const branchId = await this.resolveBranch(dto.branchId ?? null, scope);
    const supplierId = dto.supplierId ? await this.requireSupplier(dto.supplierId) : null;

    const prefix =
      dto.kind === FinanceKind.EXPENSE ? ReferencePrefix.EXPENSE : ReferencePrefix.INCOME;

    const id = await this.dataSource.transaction(async (manager) => {
      if (dto.invoiceMediaId) {
        await this.media.claim([dto.invoiceMediaId], MediaPurpose.INVOICE, manager, actor.id);
      }

      const repository = manager.getRepository(FinanceTransaction);
      const created = await repository.save(
        repository.create({
          referenceNo: await nextReferenceNo(manager, prefix),
          kind: dto.kind,
          amount: String(dto.amount),
          categoryId: category.id,
          transactionDate: dto.transactionDate,
          paymentMethodId: dto.paymentMethodId,
          branchId,
          supplierId,
          invoiceMediaId: dto.invoiceMediaId ?? null,
          notes: dto.notes ?? null,
          sourceRefType: null,
          sourceRefId: null,
          clientUuid: dto.clientUuid ?? null,
          isVoided: false,
          createdBy: actor.id,
        }),
      );

      await this.reevaluateBudgets(category, branchId, dto.transactionDate, manager);

      return created.id;
    });

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.FINANCE_TRANSACTION_CREATED,
      entityType: AuditEntityType.FINANCE_TRANSACTION,
      entityId: id,
      after: {
        kind: dto.kind,
        amount: dto.amount,
        categoryId: category.id,
        transactionDate: dto.transactionDate,
        branchId,
      },
    });

    return this.findById(id, scope, locale);
  }

  /**
   * A correction, not a rewrite: only manual rows inside their window, and never the `kind` — a
   * re-typed row would flip its sign in every report already run against it.
   */
  async update(
    id: string,
    dto: UpdateFinanceTransactionDto,
    scope: BranchScope,
    actor: AuthUser,
    locale: Locale,
  ): Promise<TransactionResult> {
    const transaction = await this.requireVisible(id, scope, locale);

    if (isAutoPosted(transaction.source)) {
      throw AppException.unprocessable(ErrorCode.AUTO_TRANSACTION_IMMUTABLE, {
        source: transaction.source,
      });
    }

    if (transaction.isVoided) {
      throw AppException.conflict(ErrorCode.TRANSACTION_ALREADY_VOIDED, { id });
    }

    if (
      !isWithinEditWindow(transaction.createdAt, this.business.financeEditWindowDays, new Date())
    ) {
      throw AppException.unprocessable(ErrorCode.EDIT_WINDOW_EXPIRED, {
        days: this.business.financeEditWindowDays,
      });
    }

    const category =
      dto.categoryId && dto.categoryId !== transaction.categoryId
        ? await this.categories.requireById(dto.categoryId)
        : await this.categories.requireById(transaction.categoryId);

    this.categories.assertKindMatches(category, transaction.kind);

    if (dto.transactionDate) this.assertDateAllowed(dto.transactionDate, actor);
    if (dto.paymentMethodId) await this.assertPaymentMethod(dto.paymentMethodId);
    if (dto.supplierId) await this.requireSupplier(dto.supplierId);

    const previousCategory = await this.categories.requireById(transaction.categoryId);

    await this.dataSource.transaction(async (manager) => {
      if (dto.invoiceMediaId) {
        await this.media.claim([dto.invoiceMediaId], MediaPurpose.INVOICE, manager, actor.id);
      }

      await manager.getRepository(FinanceTransaction).update(id, {
        ...(dto.amount !== undefined ? { amount: String(dto.amount) } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: category.id } : {}),
        ...(dto.transactionDate !== undefined ? { transactionDate: dto.transactionDate } : {}),
        ...(dto.paymentMethodId !== undefined ? { paymentMethodId: dto.paymentMethodId } : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
        ...(dto.invoiceMediaId !== undefined ? { invoiceMediaId: dto.invoiceMediaId } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        updatedBy: actor.id,
      });

      const date = dto.transactionDate ?? transaction.transactionDate;

      // Both categories are re-evaluated: moving spend out of one subtree can push another over,
      // and the budget the row left behind has to stop counting it.
      await this.reevaluateBudgets(category, transaction.branchId, date, manager);
      if (previousCategory.id !== category.id) {
        await this.reevaluateBudgets(
          previousCategory,
          transaction.branchId,
          transaction.transactionDate,
          manager,
        );
      }
    });

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.FINANCE_TRANSACTION_UPDATED,
      entityType: AuditEntityType.FINANCE_TRANSACTION,
      entityId: id,
      before: {
        amount: transaction.amount,
        categoryId: transaction.categoryId,
        transactionDate: transaction.transactionDate,
        notes: transaction.notes,
      },
      after: {
        amount: dto.amount !== undefined ? String(dto.amount) : transaction.amount,
        categoryId: dto.categoryId ?? transaction.categoryId,
        transactionDate: dto.transactionDate ?? transaction.transactionDate,
        notes: dto.notes !== undefined ? dto.notes : transaction.notes,
      },
    });

    return this.findById(id, scope, locale);
  }

  /**
   * The only way a booked row leaves the totals. It stays readable, carries who voided it and
   * why, and every aggregate in this module filters it out — an audit trail with a hole in it
   * where the mistake was is not an audit trail (`15`, rule 4).
   */
  async voidTransaction(
    id: string,
    dto: VoidFinanceTransactionDto,
    scope: BranchScope,
    actor: AuthUser,
    locale: Locale,
  ): Promise<TransactionResult> {
    const transaction = await this.requireVisible(id, scope, locale);

    if (transaction.isVoided) {
      throw AppException.conflict(ErrorCode.TRANSACTION_ALREADY_VOIDED, { id });
    }

    if (isAutoPosted(transaction.source)) {
      throw AppException.unprocessable(ErrorCode.AUTO_TRANSACTION_IMMUTABLE, {
        source: transaction.source,
      });
    }

    const category = await this.categories.requireById(transaction.categoryId);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(FinanceTransaction).update(id, {
        isVoided: true,
        voidedByUserId: actor.id,
        voidedAt: new Date(),
        voidReason: dto.reason,
        updatedBy: actor.id,
      });

      await this.reevaluateBudgets(
        category,
        transaction.branchId,
        transaction.transactionDate,
        manager,
      );
    });

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.FINANCE_TRANSACTION_VOIDED,
      entityType: AuditEntityType.FINANCE_TRANSACTION,
      entityId: id,
      before: { isVoided: false },
      after: { isVoided: true, reason: dto.reason },
    });

    return this.findById(id, scope, locale);
  }

  /**
   * The synchronous export (`15`), in either format the shared exporter can write.
   *
   * Both formats come out of one table rather than two builders, so the csv and the xlsx of the
   * same selection can never carry different columns — which is the failure mode of having a
   * ledger export in two places.
   */
  async export(
    query: ExportFinanceTransactionsDto,
    scope: BranchScope,
    locale: Locale,
  ): Promise<FinanceExport> {
    const format = query.format ?? 'csv';

    const qb = this.baseQuery(locale)
      .leftJoin(User, 'creator', 'creator.id = transaction.created_by')
      .addSelect('creator.full_name', 'creator_full_name');

    this.applyScope(qb, scope);
    await this.applyFilters(qb, query, scope);

    const { entities, raw } = await qb
      .orderBy('transaction.transaction_date', 'DESC')
      .addOrderBy('transaction.id', 'ASC')
      .limit(EXPORT_MAX_ROWS)
      .getRawAndEntities<{ creator_full_name: string | null }>();

    const byLabel = indexByPathLabel(await this.categories.loadAll(locale));

    const table: ExportTable = {
      title: `finance-transactions-${toDateOnly(new Date())}`,
      locale,
      // The ledger export carries no metadata block: it is a data interchange file that other
      // spreadsheets read by column position, and leading prose would shift every row.
      meta: [],
      columns: EXPORT_COLUMNS,
      rows: entities.map((transaction, index) => ({
        reference_no: transaction.referenceNo,
        transaction_date: transaction.transactionDate,
        kind: transaction.kind,
        category: localizedCategoryPath(transaction.category, byLabel, locale),
        amount: Number(transaction.amount),
        payment_method:
          pickTranslation(transaction.paymentMethod?.translations, locale)?.name ?? '',
        supplier: transaction.supplier?.name ?? '',
        branch: transaction.branch?.name ?? '',
        source: transaction.source,
        is_voided: transaction.isVoided ? 'true' : 'false',
        notes: transaction.notes ?? '',
        created_by: raw[index]?.creator_full_name ?? '',
        created_at: transaction.createdAt.toISOString(),
      })),
    };

    const file = format === 'xlsx' ? await toXlsx(table) : toCsv(table);

    return { filename: file.filename, mimeType: file.mimeType, body: file.body };
  }

  async view(locale: Locale): Promise<TransactionView> {
    return {
      locale,
      categoriesByLabel: indexByPathLabel(await this.categories.loadAll(locale)),
      editWindowDays: this.business.financeEditWindowDays,
      now: new Date(),
    };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private baseQuery(locale: Locale): SelectQueryBuilder<FinanceTransaction> {
    const qb = this.transactions
      .createQueryBuilder('transaction')
      .innerJoinAndSelect('transaction.category', 'category')
      .innerJoinAndSelect('transaction.paymentMethod', 'method')
      .leftJoinAndSelect('transaction.branch', 'branch')
      .leftJoinAndSelect('transaction.supplier', 'supplier');

    joinTranslation(qb, 'category', 'translations', locale);
    joinTranslation(qb, 'method', 'translations', locale);

    return qb;
  }

  /** Without `finance.read.all` a caller sees his branch and the company-level rows, nothing else. */
  private applyScope(qb: SelectQueryBuilder<FinanceTransaction>, scope: BranchScope): void {
    if (scope.unrestricted) return;

    qb.andWhere('(transaction.branch_id = :scopeBranch OR transaction.branch_id IS NULL)', {
      scopeBranch: scope.branchId,
    });
  }

  private async applyFilters(
    qb: SelectQueryBuilder<FinanceTransaction>,
    query: QueryFinanceTransactionsDto,
    scope: BranchScope,
  ): Promise<void> {
    if (query.kind) qb.andWhere('transaction.kind = :kind', { kind: query.kind });

    if (query.categoryId) {
      // The rolled-up filter is the default because that is what "spend on maintenance" means to
      // the person asking; the materialized path makes it one indexed probe either way.
      if (query.includeSubcategories === false) {
        qb.andWhere('transaction.category_id = :categoryId', { categoryId: query.categoryId });
      } else {
        const root = await this.categories.requireById(query.categoryId);
        qb.andWhere('category.path <@ CAST(:categoryPath AS ltree)', { categoryPath: root.path });
      }
    }

    if (scope.unrestricted && query.branchId) {
      qb.andWhere('transaction.branch_id = :branchId', { branchId: query.branchId });
    }
    if (query.paymentMethodId) {
      qb.andWhere('transaction.payment_method_id = :paymentMethodId', {
        paymentMethodId: query.paymentMethodId,
      });
    }
    if (query.supplierId) {
      qb.andWhere('transaction.supplier_id = :supplierId', { supplierId: query.supplierId });
    }
    if (query.dateFrom) {
      qb.andWhere('transaction.transaction_date >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('transaction.transaction_date <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.minAmount !== undefined) {
      qb.andWhere('transaction.amount >= :minAmount', { minAmount: query.minAmount });
    }
    if (query.maxAmount !== undefined) {
      qb.andWhere('transaction.amount <= :maxAmount', { maxAmount: query.maxAmount });
    }
    if (query.source?.length) {
      qb.andWhere('transaction.source IN (:...sources)', { sources: query.source });
    }
    if (query.search) {
      qb.andWhere('(transaction.notes ILIKE :search OR transaction.reference_no ILIKE :search)', {
        search: likePattern(query.search),
      });
    }
    if (query.hasInvoice !== undefined) {
      qb.andWhere(
        query.hasInvoice
          ? 'transaction.invoice_media_id IS NOT NULL'
          : 'transaction.invoice_media_id IS NULL',
      );
    }
    if (!query.includeVoided) qb.andWhere('transaction.is_voided = false');
  }

  private async requireVisible(
    id: string,
    scope: BranchScope,
    locale: Locale,
  ): Promise<FinanceTransaction> {
    const qb = this.baseQuery(locale).where('transaction.id = :id', { id });

    this.applyScope(qb, scope);

    const transaction = await qb.getOne();

    // Out of scope reads as absent: a transaction id must not be probeable across branches.
    if (!transaction) throw AppException.notFound(ErrorCode.NOT_FOUND);

    return transaction;
  }

  /**
   * The date rules in one place (`15`, rules 2 and 3). The backdate limit is a control on data
   * entry, not on the accountant closing a month, so `finance.update` lifts it.
   */
  private assertDateAllowed(transactionDate: string, actor: AuthUser): void {
    const today = toDateOnly(new Date());

    if (isFutureDate(transactionDate, today)) {
      throw AppException.unprocessable(ErrorCode.FUTURE_DATE_NOT_ALLOWED, {
        date: transactionDate,
      });
    }

    const days = backdateDays(transactionDate, today);
    const limit = this.business.financeBackdateLimitDays;

    if (days > limit && !actor.permissions.includes(Perm.FINANCE_UPDATE)) {
      throw AppException.unprocessable(ErrorCode.BACKDATE_LIMIT_EXCEEDED, { days: limit });
    }
  }

  private async reevaluateBudgets(
    category: FinanceCategory,
    branchId: string | null,
    transactionDate: string,
    manager: EntityManager,
  ): Promise<void> {
    if (category.kind !== FinanceKind.EXPENSE) return;

    await this.budgets.evaluateAfterWrite(
      { categoryId: category.id, categoryPath: category.path, branchId, transactionDate },
      manager,
    );
  }

  private async resolveBranch(branchId: string | null, scope: BranchScope): Promise<string | null> {
    if (branchId === null) return null;

    if (!scope.unrestricted && branchId !== scope.branchId) {
      throw new AppException(ErrorCode.BRANCH_SCOPE_VIOLATION);
    }

    const exists = await this.dataSource.getRepository(Branch).count({ where: { id: branchId } });
    if (exists === 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'branchId', value: branchId, constraint: 'unknown branch' }],
      });
    }

    return branchId;
  }

  private async assertPaymentMethod(id: string): Promise<void> {
    const exists = await this.dataSource
      .getRepository(PaymentMethod)
      .count({ where: { id, isActive: true } });

    if (exists === 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'paymentMethodId', value: id, constraint: 'unknown payment method' }],
      });
    }
  }

  private async requireSupplier(id: string): Promise<string> {
    const exists = await this.dataSource
      .getRepository(Supplier)
      .count({ where: { id, isActive: true } });

    if (exists === 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'supplierId', value: id, constraint: 'unknown supplier' }],
      });
    }

    return id;
  }
}
