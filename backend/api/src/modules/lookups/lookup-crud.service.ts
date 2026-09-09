import { DeepPartial, Repository, SelectQueryBuilder } from 'typeorm';
import { ErrorCode } from 'src/common/constants/error-codes';
import { DEFAULT_LOCALE, Locale, SUPPORTED_LOCALES } from 'src/common/constants/locales';
import { TranslationsMap } from 'src/common/dto/translations.dto';
import { LookupEntity } from 'src/common/entities/lookup.entity';
import { AppException } from 'src/common/errors';
import { joinTranslation } from 'src/common/utils';

/** The translation fields every lookup shares. `description` is absent on name-only tables. */
export interface LookupTranslationShape {
  locale: Locale;
  name: string;
  description?: string | null;
}

interface HasTranslations<TTranslation> {
  translations: TTranslation[];
}

export interface LookupTranslationInput {
  name: string;
  description?: string;
}

export interface CreateLookupInput {
  code: string;
  isActive?: boolean;
  sortOrder?: number;
  translations: TranslationsMap<LookupTranslationInput>;
}

export interface UpdateLookupInput {
  isActive?: boolean;
  sortOrder?: number;
  translations?: TranslationsMap<LookupTranslationInput>;
}

/** Mirrors `QueryLookupDto`, so a controller can hand its query straight to the service. */
export interface LookupListOptions {
  includeInactive?: boolean;
  /** Loads every locale rather than the requested one, for the admin translations map. */
  rawTranslations?: boolean;
}

/**
 * Shared read/write behaviour for the seeded reference tables. The six lookups differ only in
 * their extra columns, so each concrete service subclasses this and passes those through
 * `extra`, rather than restating the same translation handling six times.
 *
 * Translation rows are written through the parent's `cascade: ['insert', 'update']` relation,
 * which keeps the parent and its translations in a single transaction and means this class
 * never needs to know the name of the back-reference FK column.
 */
export abstract class LookupCrudService<
  TTranslation extends LookupTranslationShape,
  TEntity extends LookupEntity & HasTranslations<TTranslation>,
> {
  protected constructor(
    protected readonly entities: Repository<TEntity>,
    /** Query-builder alias, also used to name the translation join alias. */
    protected readonly alias: string,
  ) {}

  /**
   * Inactive rows stay readable so historical records that reference a retired lookup can
   * still render its name; they are just hidden from pickers by default.
   */
  findAll(locale: Locale, options: LookupListOptions = {}): Promise<TEntity[]> {
    return this.listQuery(locale, options).getMany();
  }

  async findById(id: string, locale: Locale = DEFAULT_LOCALE): Promise<TEntity> {
    const qb = this.entities.createQueryBuilder(this.alias);
    joinTranslation(qb, this.alias, 'translations', locale);
    this.applyRelations(qb, locale);

    const entity = await qb.where(`${this.alias}.id = :id`, { id }).getOne();
    if (!entity) throw AppException.notFound();
    return entity;
  }

  /**
   * The list query without a terminal call, so a subclass can bolt on its own filters
   * (see `MachineModelsService.findAllByType`) without restating the joins and ordering.
   */
  protected listQuery(locale: Locale, options: LookupListOptions): SelectQueryBuilder<TEntity> {
    const qb = this.entities.createQueryBuilder(this.alias);

    // The admin map needs all locales; a normal read joins only what the mapper falls back through.
    if (options.rawTranslations) {
      qb.leftJoinAndSelect(`${this.alias}.translations`, `${this.alias}_tr`);
    } else {
      joinTranslation(qb, this.alias, 'translations', locale);
    }

    this.applyRelations(qb, locale);

    if (!options.includeInactive) {
      qb.andWhere(`${this.alias}.is_active = true`);
    }

    // sort_order drives picker order; code breaks ties so the list is stable across requests.
    return qb.orderBy(`${this.alias}.sort_order`, 'ASC').addOrderBy(`${this.alias}.code`, 'ASC');
  }

  /** Loads every locale, for admin screens using `?raw_translations=true`. */
  async findByIdWithAllTranslations(id: string): Promise<TEntity> {
    const entity = await this.entities
      .createQueryBuilder(this.alias)
      .leftJoinAndSelect(`${this.alias}.translations`, `${this.alias}_tr`)
      .where(`${this.alias}.id = :id`, { id })
      .getOne();

    if (!entity) throw AppException.notFound();
    return entity;
  }

  async create(
    input: CreateLookupInput,
    actorId: string,
    extra?: DeepPartial<TEntity>,
  ): Promise<TEntity> {
    await this.assertCodeAvailable(input.code);

    const entity = this.entities.create({
      ...extra,
      code: input.code,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdBy: actorId,
      translations: this.buildTranslations(input.translations),
    } as DeepPartial<TEntity>);

    const saved = await this.entities.save(entity);
    return this.findByIdWithAllTranslations(saved.id);
  }

  async update(
    id: string,
    input: UpdateLookupInput,
    actorId: string,
    extra?: DeepPartial<TEntity>,
  ): Promise<TEntity> {
    const entity = await this.findByIdWithAllTranslations(id);

    if (input.isActive !== undefined) entity.isActive = input.isActive;
    if (input.sortOrder !== undefined) entity.sortOrder = input.sortOrder;
    if (input.translations) this.mergeTranslations(entity, input.translations);

    if (extra) Object.assign(entity, extra);
    entity.updatedBy = actorId;

    await this.entities.save(entity);
    return this.findByIdWithAllTranslations(id);
  }

  /** Hook for subclasses that need to eager-load a parent relation. No-op by default. */
  protected applyRelations(_qb: SelectQueryBuilder<TEntity>, _locale: Locale): void {}

  protected async assertCodeAvailable(code: string): Promise<void> {
    const existing = await this.entities
      .createQueryBuilder(this.alias)
      .withDeleted()
      .where(`${this.alias}.code = :code`, { code })
      .getOne();

    if (existing) throw AppException.conflict(ErrorCode.CODE_EXISTS, { code });
  }

  /** Builds the rows for a create. Rejects a payload with no default-locale entry. */
  private buildTranslations(translations: TranslationsMap<LookupTranslationInput>): TTranslation[] {
    if (!translations[DEFAULT_LOCALE]) {
      throw new AppException(ErrorCode.DEFAULT_LOCALE_REQUIRED);
    }

    const rows: TTranslation[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      const payload = translations[locale];
      if (!payload) continue;
      rows.push(this.toTranslationRow(locale, payload));
    }
    return rows;
  }

  /** Updates the rows present in the payload and appends the ones that do not exist yet. */
  private mergeTranslations(
    entity: TEntity,
    translations: TranslationsMap<LookupTranslationInput>,
  ): void {
    entity.translations ??= [];

    for (const locale of SUPPORTED_LOCALES) {
      const payload = translations[locale];
      if (!payload) continue;

      const existing = entity.translations.find((row) => row.locale === locale);
      if (existing) {
        existing.name = payload.name;
        if (payload.description !== undefined) existing.description = payload.description;
      } else {
        entity.translations.push(this.toTranslationRow(locale, payload));
      }
    }
  }

  /**
   * The row is a plain object rather than a repository-created instance: the cascade only needs
   * the columns, and this keeps the base class free of the concrete translation class.
   */
  private toTranslationRow(locale: Locale, payload: LookupTranslationInput): TTranslation {
    const row: LookupTranslationShape = { locale, name: payload.name };
    if (payload.description !== undefined) row.description = payload.description;
    return row as TTranslation;
  }
}
