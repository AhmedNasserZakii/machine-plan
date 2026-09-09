import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { DEFAULT_LOCALE, Locale, SUPPORTED_LOCALES } from 'src/common/constants/locales';
import { TranslationsMap } from 'src/common/dto/translations.dto';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import { FinanceKind } from 'src/common/enums/finance.enum';
import { AppException } from 'src/common/errors';
import { joinTranslation } from 'src/common/utils';
import {
  CreateFinanceCategoryDto,
  MoveFinanceCategoryDto,
  QueryFinanceCategoriesDto,
  QueryFinanceCategoryTreeDto,
  UpdateFinanceCategoryDto,
} from '../dto/finance-category.dto';
import { FinanceCategory } from '../entities/finance-category.entity';
import { FinanceCategoryTranslation } from '../entities/finance-category-translation.entity';
import { FinanceTransaction } from '../entities/finance-transaction.entity';
import { buildPath, depthOf, toPathLabel, wouldCreateCycle } from '../category-path';
import {
  assembleCategoryTree,
  CategoryAggregate,
  categoryName,
  CategoryTreeNode,
  flattenCategoryTree,
  limitTreeDepth,
  pruneCategoryTree,
  subtreeRows,
} from '../category-tree';

/** The seeded codes other modules post against. Their identity is fixed; their names are not. */
export const SystemCategoryCode = {
  MAINTENANCE: 'MAINTENANCE',
  MACHINE_PURCHASE: 'MACHINE_PURCHASE',
  VIOLATION_CHARGES: 'VIOLATION_CHARGES',
  MERCHANT_SUBSCRIPTIONS: 'MERCHANT_SUBSCRIPTIONS',
} as const;

export type SystemCategoryCodeValue = (typeof SystemCategoryCode)[keyof typeof SystemCategoryCode];

interface CategoryTranslationInput {
  name: string;
  description?: string;
}

@Injectable()
export class FinanceCategoriesService {
  constructor(
    @InjectRepository(FinanceCategory)
    private readonly categories: Repository<FinanceCategory>,
    @InjectRepository(FinanceTransaction)
    private readonly transactions: Repository<FinanceTransaction>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /**
   * Every category, with the requested locale joined.
   *
   * Loaded whole rather than by level, for the same reason `14` returns the entire tree in one
   * call: realistic counts are dozens, and every roll-up on a report needs the ancestry of rows
   * that were filtered out of the page anyway.
   */
  loadAll(locale: Locale, manager?: EntityManager): Promise<FinanceCategory[]> {
    const repository = manager ? manager.getRepository(FinanceCategory) : this.categories;
    const qb = repository.createQueryBuilder('category');

    joinTranslation(qb, 'category', 'translations', locale);

    return qb.orderBy('category.path', 'ASC').getMany();
  }

  /** The flat list, with roll-ups intact even where a filter removed a node's descendants. */
  async findAll(query: QueryFinanceCategoriesDto, locale: Locale): Promise<CategoryTreeNode[]> {
    const nodes = flattenCategoryTree(await this.fullTree(locale));

    return nodes.filter((node) => {
      const category = node.category;

      if (query.kind && category.kind !== query.kind) return false;
      if (query.parentId && category.parentId !== query.parentId) return false;
      if (!query.includeInactive && !category.isActive) return false;

      if (query.search) {
        const name = categoryName(category, locale).toLocaleLowerCase();
        if (!name.includes(query.search.toLocaleLowerCase())) return false;
      }

      return true;
    });
  }

  async tree(query: QueryFinanceCategoryTreeDto, locale: Locale): Promise<CategoryTreeNode[]> {
    const all = await this.loadAll(locale);
    const scoped = query.rootCategoryId
      ? subtreeRows(all, this.pick(all, query.rootCategoryId))
      : all;

    const kindFiltered = query.kind
      ? scoped.filter((category) => category.kind === query.kind)
      : scoped;

    let nodes = assembleCategoryTree(kindFiltered, await this.directTotals());

    if (!query.includeInactive) {
      nodes = pruneCategoryTree(nodes, (node) => node.category.isActive);
    }

    return query.maxDepth === undefined ? nodes : limitTreeDepth(nodes, query.maxDepth);
  }

  async findById(id: string, locale: Locale): Promise<CategoryTreeNode> {
    const node = flattenCategoryTree(await this.fullTree(locale)).find(
      (candidate) => candidate.category.id === id,
    );

    if (!node) throw AppException.notFound(ErrorCode.NOT_FOUND);

    return node;
  }

  /** Root first, the node itself last — what a header renders above a category's transactions. */
  async breadcrumb(id: string, locale: Locale): Promise<FinanceCategory[]> {
    const all = await this.loadAll(locale);
    const category = this.pick(all, id);
    const byLabel = new Map(all.map((row) => [toPathLabel(row.id), row]));

    return category.path
      .split('.')
      .map((label) => byLabel.get(label))
      .filter((row): row is FinanceCategory => row !== undefined);
  }

  /**
   * The id is generated here rather than by the database because the materialized path is built
   * from it: the row cannot be written until its own label is known.
   */
  async create(
    dto: CreateFinanceCategoryDto,
    actorId: string,
    locale: Locale,
  ): Promise<CategoryTreeNode> {
    const parent = dto.parentId ? await this.requireById(dto.parentId) : null;

    if (parent && parent.kind !== dto.kind) {
      throw AppException.unprocessable(ErrorCode.CATEGORY_KIND_MISMATCH, {
        kind: parent.kind,
      });
    }

    const id = randomUUID();
    const path = buildPath(parent?.path ?? null, id);

    await this.categories.save(
      this.categories.create({
        id,
        code: null,
        parentId: parent?.id ?? null,
        path,
        depth: depthOf(path),
        kind: dto.kind,
        isSystem: false,
        isActive: true,
        sortOrder: dto.sortOrder ?? 0,
        createdBy: actorId,
        translations: this.buildTranslations(dto.translations),
      }),
    );

    await this.audit.record({
      userId: actorId,
      action: AuditAction.FINANCE_CATEGORY_CREATED,
      entityType: AuditEntityType.FINANCE_CATEGORY,
      entityId: id,
      after: { kind: dto.kind, parentId: parent?.id ?? null },
    });

    return this.findById(id, locale);
  }

  async update(
    id: string,
    dto: UpdateFinanceCategoryDto,
    actorId: string,
    locale: Locale,
  ): Promise<CategoryTreeNode> {
    const category = await this.categories.findOne({
      where: { id },
      relations: { translations: true },
    });

    if (!category) throw AppException.notFound(ErrorCode.NOT_FOUND);

    const before = { sortOrder: category.sortOrder, isActive: category.isActive };

    if (dto.translations) this.mergeTranslations(category, dto.translations);
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;
    category.updatedBy = actorId;

    await this.categories.save(category);

    await this.audit.record({
      userId: actorId,
      action: AuditAction.FINANCE_CATEGORY_UPDATED,
      entityType: AuditEntityType.FINANCE_CATEGORY,
      entityId: id,
      before,
      after: { sortOrder: category.sortOrder, isActive: category.isActive },
    });

    return this.findById(id, locale);
  }

  /**
   * Re-parents a node and rewrites the path and depth of its whole subtree in one statement,
   * inside one transaction: a half-moved tree has descendants pointing at a path their parent no
   * longer occupies, and every roll-up over them would silently return the wrong number.
   */
  async move(
    id: string,
    dto: MoveFinanceCategoryDto,
    actorId: string,
    locale: Locale,
  ): Promise<CategoryTreeNode> {
    const category = await this.requireById(id);
    const newParent = dto.newParentId ? await this.requireById(dto.newParentId) : null;

    if (newParent && newParent.kind !== category.kind) {
      throw AppException.unprocessable(ErrorCode.CATEGORY_KIND_MISMATCH, {
        kind: newParent.kind,
      });
    }

    if (wouldCreateCycle(category.path, newParent?.path ?? null)) {
      throw AppException.unprocessable(ErrorCode.CIRCULAR_CATEGORY_REFERENCE);
    }

    if ((newParent?.id ?? null) !== category.parentId) {
      await this.dataSource.transaction(async (manager) => {
        // `''::ltree` concatenates to a no-op, so promoting a subtree to the root is the same
        // statement as re-parenting it rather than a second branch to keep in step.
        await manager.query(
          `UPDATE finance_categories
              SET path = ($1::ltree || subpath(path, nlevel($2::ltree) - 1)),
                  depth = nlevel($1::ltree || subpath(path, nlevel($2::ltree) - 1)) - 1,
                  updated_at = now(),
                  updated_by = $3
            WHERE path <@ $2::ltree
              AND deleted_at IS NULL`,
          [newParent?.path ?? '', category.path, actorId],
        );

        await manager
          .getRepository(FinanceCategory)
          .update(id, { parentId: newParent?.id ?? null, updatedBy: actorId });
      });

      await this.audit.record({
        userId: actorId,
        action: AuditAction.FINANCE_CATEGORY_MOVED,
        entityType: AuditEntityType.FINANCE_CATEGORY,
        entityId: id,
        before: { parentId: category.parentId },
        after: { parentId: newParent?.id ?? null },
      });
    }

    return this.findById(id, locale);
  }

  /**
   * Deactivation, not deletion, is the answer for a category with history — which is why both
   * refusals below name what is in the way and the count of it.
   */
  async remove(id: string, actorId: string): Promise<void> {
    const category = await this.requireById(id);

    if (category.isSystem) {
      throw AppException.forbidden(ErrorCode.SYSTEM_CATEGORY_PROTECTED, {
        code: category.code ?? '',
      });
    }

    const children = await this.categories.count({ where: { parentId: id } });
    if (children > 0) {
      throw AppException.conflict(ErrorCode.CATEGORY_HAS_CHILDREN, { count: children });
    }

    // Voided rows count: they are still history, and a category the ledger references cannot
    // go away without taking the reason for a number with it.
    const booked = await this.transactions.count({ where: { categoryId: id } });
    if (booked > 0) {
      throw AppException.conflict(ErrorCode.CATEGORY_HAS_TRANSACTIONS, { count: booked });
    }

    await this.categories.update(id, { updatedBy: actorId });
    await this.categories.softDelete(id);

    await this.audit.record({
      userId: actorId,
      action: AuditAction.FINANCE_CATEGORY_DELETED,
      entityType: AuditEntityType.FINANCE_CATEGORY,
      entityId: id,
      before: { kind: category.kind, parentId: category.parentId },
    });
  }

  // ── used by the rest of the finance module ─────────────────────────────────

  async requireById(id: string, manager?: EntityManager): Promise<FinanceCategory> {
    const repository = manager ? manager.getRepository(FinanceCategory) : this.categories;
    const category = await repository.findOne({ where: { id } });

    if (!category) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'categoryId', value: id, constraint: 'unknown category' }],
      });
    }

    return category;
  }

  /** How auto-posting finds its target. A missing system row is a seeding fault, not input. */
  async requireByCode(
    code: SystemCategoryCodeValue,
    manager?: EntityManager,
  ): Promise<FinanceCategory> {
    const repository = manager ? manager.getRepository(FinanceCategory) : this.categories;
    const category = await repository.findOne({ where: { code, isSystem: true } });

    if (!category) {
      throw new AppException(ErrorCode.INTERNAL_ERROR, {
        details: [{ field: 'categoryCode', value: code, constraint: 'system category not seeded' }],
      });
    }

    return category;
  }

  /** The `kind` a transaction must declare to be booked here (`15`, rule 1). */
  assertKindMatches(category: FinanceCategory, kind: FinanceKind): void {
    if (category.kind !== kind) {
      throw AppException.unprocessable(ErrorCode.CATEGORY_KIND_MISMATCH, { kind: category.kind });
    }
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async fullTree(locale: Locale): Promise<CategoryTreeNode[]> {
    return assembleCategoryTree(await this.loadAll(locale), await this.directTotals());
  }

  /** One grouped query for the whole table, rather than a count per node on the screen. */
  private async directTotals(): Promise<Map<string, CategoryAggregate>> {
    const rows = await this.transactions
      .createQueryBuilder('transaction')
      .select('transaction.category_id', 'categoryId')
      .addSelect('SUM(transaction.amount)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('transaction.is_voided = false')
      .groupBy('transaction.category_id')
      .getRawMany<{ categoryId: string; total: string; count: string }>();

    return new Map(
      rows.map((row) => [row.categoryId, { total: Number(row.total), count: Number(row.count) }]),
    );
  }

  private pick(categories: FinanceCategory[], id: string): FinanceCategory {
    const category = categories.find((candidate) => candidate.id === id);
    if (!category) throw AppException.notFound(ErrorCode.NOT_FOUND);

    return category;
  }

  private buildTranslations(
    translations: TranslationsMap<CategoryTranslationInput>,
  ): FinanceCategoryTranslation[] {
    if (!translations[DEFAULT_LOCALE]) {
      throw new AppException(ErrorCode.DEFAULT_LOCALE_REQUIRED);
    }

    const rows: FinanceCategoryTranslation[] = [];

    for (const locale of SUPPORTED_LOCALES) {
      const payload = translations[locale];
      if (!payload) continue;

      rows.push({
        locale,
        name: payload.name,
        description: payload.description ?? null,
      } as FinanceCategoryTranslation);
    }

    return rows;
  }

  private mergeTranslations(
    category: FinanceCategory,
    translations: TranslationsMap<CategoryTranslationInput>,
  ): void {
    category.translations ??= [];

    for (const locale of SUPPORTED_LOCALES) {
      const payload = translations[locale];
      if (!payload) continue;

      const existing = category.translations.find((row) => row.locale === locale);

      if (existing) {
        existing.name = payload.name;
        if (payload.description !== undefined) existing.description = payload.description;
      } else {
        category.translations.push({
          locale,
          name: payload.name,
          description: payload.description ?? null,
        } as FinanceCategoryTranslation);
      }
    }
  }
}
