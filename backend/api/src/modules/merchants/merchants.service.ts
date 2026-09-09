import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  IsNull,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import {
  FinanceKind,
  SubscriptionPlanType,
  TransactionSource,
} from 'src/common/enums/finance.enum';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { MediaPurpose } from 'src/common/enums/operations.enum';
import { PartyType } from 'src/common/enums/transfer.enum';
import { AppException } from 'src/common/errors';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import { deterministicUuid, likePattern } from 'src/common/utils';
import { normalizePhone } from 'src/common/utils/phone.util';
import { SystemCategoryCode } from 'src/modules/finance/services/finance-categories.service';
import {
  FinancePostingService,
  FinanceSourceRefType,
} from 'src/modules/finance/services/finance-posting.service';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { MediaService } from 'src/modules/media/media.service';
import { PaymentMethod } from 'src/modules/lookups/entities/payment-method.entity';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import {
  CheckMerchantDto,
  CollectSubscriptionDto,
  CreateMerchantDto,
  CreateSubscriptionDto,
  QueryMerchantsDto,
  UpdateMerchantDto,
  UpdateSubscriptionDto,
} from './dto/merchant.dto';
import { MerchantSubscription } from './entities/merchant-subscription.entity';
import { Merchant } from './entities/merchant.entity';

/** A merchant plus the live machine count that every response carries. */
export interface MerchantWithCount {
  merchant: Merchant;
  machinesCount: number;
}

export interface MerchantDuplicates {
  warnings: string[];
  existing: MerchantWithCount[];
}

/** One line of "what has this shop done", assembled from three tables (`08`). */
export interface MerchantTimelineEntry {
  kind: 'TRANSFER' | 'SUBSCRIPTION_STARTED' | 'COLLECTION';
  occurredAt: Date;
  referenceNo: string | null;
  machineSerial: string | null;
  amount: number | null;
  code: string;
}

/** A repair a shop has to pay for, handed over by the maintenance close flow (`11`). */
export interface OneTimeFeeContext {
  merchantId: string;
  machineId: string;
  amount: number;
  /** Date-only: `merchant_subscriptions.start_date` is a `date` column. */
  chargedOn: string;
  notes: string;
  actorId: string;
}

/** How far `nextDueDate` moves on each collection. `NONE` never generates a due date at all. */
const PERIOD_DAYS: Partial<Record<SubscriptionPlanType, number>> = {
  [SubscriptionPlanType.WEEKLY]: 7,
};

@Injectable()
export class MerchantsService {
  constructor(
    @InjectRepository(Merchant) private readonly merchants: Repository<Merchant>,
    @InjectRepository(MerchantSubscription)
    private readonly subscriptions: Repository<MerchantSubscription>,
    private readonly media: MediaService,
    private readonly posting: FinancePostingService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    query: QueryMerchantsDto,
    scope: BranchScope,
    actor: AuthUser,
  ): Promise<PaginatedResult<MerchantWithCount>> {
    const qb = this.baseQuery();

    this.applyScope(qb, scope, actor);

    if (scope.unrestricted && query.branchId) {
      qb.andWhere('merchant.branch_id = :branchId', { branchId: query.branchId });
    }

    if (query.createdByUserId) {
      qb.andWhere('merchant.created_by_user_id = :creator', { creator: query.createdByUserId });
    }

    // Defaults to the live book of trade: a deactivated merchant is history, and the picker a
    // representative opens to place a machine must not offer him one. `includeInactive` is the
    // only way to ask for both halves, since `isActive=false` narrows to the closed ones.
    if (!query.includeInactive) {
      qb.andWhere('merchant.is_active = :isActive', { isActive: query.isActive ?? true });
    }

    if (query.search) {
      const search = likePattern(query.search);
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('merchant.name ILIKE :search')
            .orWhere('merchant.shop_name ILIKE :search')
            .orWhere('merchant.phone ILIKE :search');
        }),
        { search },
      );
    }

    if (query.hasMachines !== undefined) {
      const clause = `EXISTS (
        SELECT 1 FROM machines m
        WHERE m.current_holder_type = '${PartyType.MERCHANT}'
          AND m.current_holder_id = merchant.id
          AND m.status = '${MachineStatus.WITH_MERCHANT}'
      )`;
      qb.andWhere(query.hasMachines ? clause : `NOT ${clause}`);
    }

    qb.orderBy(`merchant.${query.sortBy}`, query.order).addOrderBy('merchant.id', 'ASC');
    qb.skip(query.skip).take(query.take);

    const [rows, total] = await qb.getManyAndCount();

    return new PaginatedResult(await this.withCounts(rows), total, query.page, query.limit);
  }

  /**
   * The caller's book of trade, unpaginated — what an offline device needs before it loses signal
   * (`20`, bootstrap). Scoped exactly like the merchant list, so a representative still only sees
   * the shops he registered. `since` narrows it to what has changed, for the delta call.
   */
  async visibleForSync(
    scope: BranchScope,
    actor: AuthUser,
    since?: Date,
  ): Promise<MerchantWithCount[]> {
    const qb = this.baseQuery().andWhere('merchant.is_active = true');

    this.applyScope(qb, scope, actor);

    if (since) {
      qb.andWhere('merchant.updated_at > :since', { since });
    }

    return this.withCounts(await qb.orderBy('merchant.name', 'ASC').getMany());
  }

  /**
   * Merchants the device must drop: closed out or deleted since `since`. A deactivated shop is
   * gone as far as the app is concerned — it may not be handed a machine, and it is precisely
   * what `visibleForSync` stops returning.
   */
  async closedSince(scope: BranchScope, actor: AuthUser, since: Date): Promise<string[]> {
    const qb = this.merchants
      .createQueryBuilder('merchant')
      .withDeleted()
      .select('merchant.id', 'id')
      .where('(merchant.is_active = false OR merchant.deleted_at IS NOT NULL)')
      .andWhere('merchant.updated_at > :since', { since });

    this.applyScope(qb, scope, actor);

    const rows = await qb.getRawMany<{ id: string }>();
    return rows.map((row) => row.id);
  }

  async findById(id: string, scope: BranchScope, actor: AuthUser): Promise<MerchantWithCount> {
    const merchant = await this.detailQuery().where('merchant.id = :id', { id }).getOne();

    if (!merchant || !this.canSee(merchant, scope, actor)) {
      throw AppException.notFound(ErrorCode.NOT_FOUND);
    }

    return { merchant, machinesCount: await this.countMachines(merchant.id) };
  }

  /**
   * The pre-flight for the registration form. A repeated phone is reported and allowed — a shop
   * and its owner share a line often enough that blocking it would only teach the field to invent
   * numbers — but a repeated national ID is the one thing that is always a mistake.
   */
  async checkDuplicates(
    dto: CheckMerchantDto,
    scope: BranchScope,
    actor: AuthUser,
  ): Promise<MerchantDuplicates> {
    const warnings: string[] = [];
    const found = new Map<string, Merchant>();

    const byPhone = await this.baseQuery()
      .andWhere('merchant.phone = :phone', { phone: normalizePhone(dto.phone) })
      .andWhere('merchant.is_active = true')
      .getMany();

    // Only same-branch matches are surfaced: another branch's merchant is not a duplicate this
    // representative can do anything about, and showing it would leak the other branch's book.
    const sameBranch = byPhone.filter(
      (merchant) => scope.unrestricted || merchant.branchId === actor.branchId,
    );

    if (sameBranch.length > 0) {
      warnings.push('DUPLICATE_PHONE');
      for (const merchant of sameBranch) found.set(merchant.id, merchant);
    }

    if (dto.nationalId) {
      const byNationalId = await this.merchants.findOne({
        where: { nationalId: dto.nationalId },
        relations: { branch: true },
      });

      if (byNationalId) {
        // The warning is unavoidable — national id is globally unique, so the create would
        // fail regardless and the user is entitled to know why. The *record* is not: the
        // same reasoning as the phone check above, which is scoped a few lines up. Returning
        // it would turn this endpoint into a national-id lookup for the whole company.
        warnings.push('DUPLICATE_NATIONAL_ID');

        if (scope.unrestricted || byNationalId.branchId === actor.branchId) {
          found.set(byNationalId.id, byNationalId);
        }
      }
    }

    return { warnings, existing: await this.withCounts([...found.values()]) };
  }

  async create(dto: CreateMerchantDto, actor: AuthUser): Promise<MerchantWithCount> {
    const phone = normalizePhone(dto.phone);

    // A shop registered offline and submitted twice is one shop (`20`, mechanism 1). Scoped to
    // the registrar so a leaked id cannot be used to read another branch's merchant.
    if (dto.clientUuid) {
      const replayed = await this.merchants.findOne({
        where: { clientUuid: dto.clientUuid, createdByUserId: actor.id },
      });

      if (replayed) {
        return this.findById(replayed.id, { branchId: null, unrestricted: true }, actor);
      }
    }

    await this.assertNationalIdIsFree(dto.nationalId);

    const created = await this.merchants.save(
      this.merchants.create({
        name: dto.name,
        phone,
        shopName: dto.shopName,
        address: dto.address,
        nationalId: dto.nationalId ?? null,
        // Both taken from the actor, never the body (`08`): they are what scopes the merchant
        // list, so a client that could set them could read another branch's book of trade.
        branchId: actor.branchId,
        createdByUserId: actor.id,
        notes: dto.notes ?? null,
        isActive: true,
        clientUuid: dto.clientUuid ?? null,
        createdBy: actor.id,
      }),
    );

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.MERCHANT_CREATED,
      entityType: AuditEntityType.MERCHANT,
      entityId: created.id,
      after: {
        name: created.name,
        phone: created.phone,
        shopName: created.shopName,
        nationalId: created.nationalId,
        branchId: created.branchId,
      },
    });

    return this.findById(created.id, { branchId: null, unrestricted: true }, actor);
  }

  async update(
    id: string,
    dto: UpdateMerchantDto,
    scope: BranchScope,
    actor: AuthUser,
  ): Promise<MerchantWithCount> {
    const { merchant } = await this.findById(id, scope, actor);

    if (dto.nationalId !== undefined && dto.nationalId !== merchant.nationalId) {
      await this.assertNationalIdIsFree(dto.nationalId, merchant.id);
    }

    const patch = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.phone !== undefined ? { phone: normalizePhone(dto.phone) } : {}),
      ...(dto.shopName !== undefined ? { shopName: dto.shopName } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.nationalId !== undefined ? { nationalId: dto.nationalId } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      updatedBy: actor.id,
    };

    await this.merchants.update(id, patch);

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.MERCHANT_UPDATED,
      entityType: AuditEntityType.MERCHANT,
      entityId: id,
      before: {
        name: merchant.name,
        phone: merchant.phone,
        shopName: merchant.shopName,
        address: merchant.address,
        nationalId: merchant.nationalId,
      },
      after: {
        name: patch.name ?? merchant.name,
        phone: patch.phone ?? merchant.phone,
        shopName: patch.shopName ?? merchant.shopName,
        address: 'address' in patch ? patch.address : merchant.address,
        nationalId: 'nationalId' in patch ? patch.nationalId : merchant.nationalId,
      },
    });

    return this.findById(id, scope, actor);
  }

  /**
   * A merchant holding machines cannot be closed out: the units have to come back through a
   * `MERCHANT_TO_REPRESENTATIVE` hand-off first, or the fleet would lose track of where they are.
   * The serials go out with the error so the representative knows what to collect.
   */
  async deactivate(id: string, scope: BranchScope, actor: AuthUser): Promise<MerchantWithCount> {
    const { merchant } = await this.findById(id, scope, actor);

    const held = await this.heldMachines(merchant.id);
    if (held.length > 0) {
      throw new AppException(ErrorCode.MERCHANT_HAS_MACHINES, {
        status: 409,
        params: { count: held.length },
        details: held.map((machine) => ({
          field: 'machines',
          value: machine.serial,
          constraint: 'still with this merchant',
        })),
      });
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Merchant).update(id, { isActive: false, updatedBy: actor.id });

      // A closed shop has nothing left to pay. Leaving the plan live would keep it turning up in
      // the overdue sweep forever.
      await manager
        .getRepository(MerchantSubscription)
        .update({ merchantId: id, isActive: true }, { isActive: false, updatedBy: actor.id });
    });

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.MERCHANT_DEACTIVATED,
      entityType: AuditEntityType.MERCHANT,
      entityId: id,
      before: { isActive: true },
      after: { isActive: false },
    });

    return this.findById(id, { branchId: null, unrestricted: true }, actor);
  }

  /** Machines this merchant is holding right now. */
  async machinesOf(id: string, scope: BranchScope, actor: AuthUser): Promise<Machine[]> {
    const { merchant } = await this.findById(id, scope, actor);
    return this.heldMachines(merchant.id);
  }

  // ── subscriptions ──────────────────────────────────────────────────────────

  async subscriptionsOf(
    id: string,
    scope: BranchScope,
    actor: AuthUser,
  ): Promise<MerchantSubscription[]> {
    const { merchant } = await this.findById(id, scope, actor);

    return this.subscriptions.find({
      where: { merchantId: merchant.id },
      relations: { machine: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createSubscription(
    merchantId: string,
    dto: CreateSubscriptionDto,
    scope: BranchScope,
    actor: AuthUser,
  ): Promise<MerchantSubscription> {
    const { merchant } = await this.findById(merchantId, scope, actor);

    // Started in the shop, submitted twice on the way back. Without this the retry is refused
    // as a clashing plan by the plan the first attempt already created (`20`, mechanism 1).
    if (dto.clientUuid) {
      const replayed = await this.subscriptions.findOne({
        where: { clientUuid: dto.clientUuid, createdBy: actor.id },
      });

      if (replayed) return this.loadSubscription(replayed.id);
    }

    if (dto.planType === SubscriptionPlanType.NONE && dto.amount !== 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'amount', value: dto.amount, constraint: 'must be 0 for a NONE plan' }],
      });
    }

    if (dto.machineId) {
      await this.assertMachineIsWithMerchant(dto.machineId, merchant.id);
    }

    // The unique indexes are the real guarantee; this turns a driver error into a sentence about
    // the plan that is already running.
    //
    // `machineId: null` in a TypeORM `where` is dropped from the query rather than compiled
    // to `IS NULL`, so the merchant-wide case silently matched *any* active subscription —
    // and a per-machine plan then blocked an unrelated merchant-wide one. `IsNull()` is the
    // operator that actually says what was meant.
    const clashing = await this.subscriptions.findOne({
      where: {
        merchantId: merchant.id,
        isActive: true,
        machineId: dto.machineId ? dto.machineId : IsNull(),
      },
    });

    if (clashing) {
      throw AppException.conflict(ErrorCode.VALIDATION_FAILED, { id: clashing.id });
    }

    const created = await this.subscriptions.save(
      this.subscriptions.create({
        merchantId: merchant.id,
        machineId: dto.machineId ?? null,
        planType: dto.planType,
        amount: String(dto.amount),
        startDate: dto.startDate,
        endDate: dto.endDate ?? null,
        nextDueDate: firstDueDate(dto.planType, dto.startDate),
        isActive: true,
        notes: dto.notes ?? null,
        clientUuid: dto.clientUuid ?? null,
        createdBy: actor.id,
      }),
    );

    return this.loadSubscription(created.id);
  }

  /**
   * A repair the shop has to pay for (`11`, step 4), booked as a one-off charge rather than an
   * income row: the money is not in the till yet, and it is realised through the same
   * `collectSubscription` path as every other thing a merchant owes.
   *
   * Unlike `createSubscription` this takes no branch scope — it runs inside the maintenance
   * transaction, on behalf of a caller who has already been authorised to close the order, and
   * the merchant it charges is the one the machine was placed with.
   */
  async createOneTimeFee(
    context: OneTimeFeeContext,
    manager: EntityManager,
  ): Promise<MerchantSubscription> {
    const merchant = await manager
      .getRepository(Merchant)
      .findOne({ where: { id: context.merchantId } });

    if (!merchant) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          {
            field: 'responsibleMerchantId',
            value: context.merchantId,
            constraint: 'unknown merchant',
          },
        ],
      });
    }

    const repo = manager.getRepository(MerchantSubscription);

    return repo.save(
      repo.create({
        merchantId: merchant.id,
        machineId: context.machineId,
        planType: SubscriptionPlanType.ONE_TIME_FEE,
        amount: String(context.amount),
        startDate: context.chargedOn,
        endDate: null,
        // Due immediately: a one-off is owed from the day the repair was handed back, and the
        // overdue sweep is how the shop is chased for it.
        nextDueDate: context.chargedOn,
        isActive: true,
        notes: context.notes,
        createdBy: context.actorId,
      }),
    );
  }

  async updateSubscription(
    id: string,
    dto: UpdateSubscriptionDto,
    scope: BranchScope,
    actor: AuthUser,
  ): Promise<MerchantSubscription> {
    const { subscription } = await this.loadSubscriptionScoped(id, scope, actor);

    if (
      dto.amount !== undefined &&
      dto.amount !== 0 &&
      subscription.planType === SubscriptionPlanType.NONE
    ) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'amount', value: dto.amount, constraint: 'must be 0 for a NONE plan' }],
      });
    }

    await this.subscriptions.update(id, {
      ...(dto.amount !== undefined ? { amount: String(dto.amount) } : {}),
      ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.isActive !== undefined
        ? // Ending a plan clears the due date rather than leaving one behind for the overdue
          // sweep to keep reporting on a shop that owes nothing.
          { isActive: dto.isActive, ...(dto.isActive ? {} : { nextDueDate: null }) }
        : {}),
      updatedBy: actor.id,
    });

    return this.loadSubscription(id);
  }

  /**
   * Money in. In one transaction the collection is recorded on the plan, the due date rolls
   * forward, and the income lands in the ledger.
   *
   * A plan is collected from every month, so the posting's identity cannot be the plan's id — the
   * second collection would be swallowed as a replay of the first. It is derived instead from the
   * plan plus the collection's own sequence number, taken under the same row lock that increments
   * it: the same collection retried resolves to the same id and books nothing new, while the next
   * one is a different event and books normally.
   */
  async collectSubscription(
    id: string,
    dto: CollectSubscriptionDto,
    scope: BranchScope,
    actor: AuthUser,
  ): Promise<MerchantSubscription> {
    const { subscription, merchant } = await this.loadSubscriptionScoped(id, scope, actor);

    if (!subscription.isActive) {
      throw AppException.unprocessable(ErrorCode.VALIDATION_FAILED, { id });
    }

    if (subscription.planType === SubscriptionPlanType.NONE) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'planType', constraint: 'a NONE plan collects nothing' }],
      });
    }

    await this.assertPaymentMethod(dto.paymentMethodId);

    await this.dataSource.transaction(async (manager) => {
      if (dto.invoiceMediaId) {
        await this.media.claim([dto.invoiceMediaId], MediaPurpose.INVOICE, manager, actor.id);
      }

      const repo = manager.getRepository(MerchantSubscription);

      // Locked so two collections taken on two phones both land rather than one overwriting the
      // other's running total.
      const locked = await repo
        .createQueryBuilder('subscription')
        .where('subscription.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();

      if (!locked) throw AppException.notFound(ErrorCode.NOT_FOUND);

      const sequence = locked.collectionCount + 1;

      await repo
        .createQueryBuilder()
        .update(MerchantSubscription)
        .set({
          // Added by Postgres against the numeric column rather than in JS. Reading a
          // numeric into a JS float and writing it back rounds the running total on every
          // collection, and this is money the company will be asked to account for.
          totalCollected: () => 'total_collected + :amount',
          collectionCount: sequence,
          lastCollectedAt: new Date(dto.collectedAt),
          nextDueDate: rollDueDate(locked),
          updatedBy: actor.id,
        })
        .where('id = :id', { id })
        .setParameter('amount', dto.amount)
        .execute();

      await this.posting.post(
        {
          kind: FinanceKind.INCOME,
          amount: dto.amount,
          categoryCode: SystemCategoryCode.MERCHANT_SUBSCRIPTIONS,
          transactionDate: new Date(dto.collectedAt),
          paymentMethodId: dto.paymentMethodId,
          branchId: merchant.branchId,
          source: TransactionSource.AUTO_SUBSCRIPTION,
          sourceRefType: FinanceSourceRefType.SUBSCRIPTION_COLLECTION,
          sourceRefId: deterministicUuid(subscription.id, `collection:${sequence}`),
          notes: dto.notes ?? null,
          actorId: actor.id,
        },
        manager,
      );
    });

    return this.loadSubscription(id);
  }

  /**
   * What has happened to this shop, newest first: hand-offs in and out, plans starting, money
   * collected. Assembled in the service rather than in SQL because the three sources have nothing
   * in common but a timestamp.
   */
  async timeline(
    id: string,
    limit: number,
    scope: BranchScope,
    actor: AuthUser,
  ): Promise<MerchantTimelineEntry[]> {
    const { merchant } = await this.findById(id, scope, actor);

    const transfers = await this.dataSource.query<
      Array<{
        occurred_at: Date;
        reference_no: string;
        type: string;
        serial: string;
        direction: string;
      }>
    >(
      `SELECT t.occurred_at, t.reference_no, t.type, t.direction, m.serial
         FROM transfers t
         JOIN transfer_items ti ON ti.transfer_id = t.id
         JOIN machines m ON m.id = ti.machine_id
        WHERE t.status = 'CONFIRMED'
          AND (
            (t.to_party_type = $1 AND t.to_party_id = $2)
            OR (t.from_party_type = $1 AND t.from_party_id = $2)
          )
        ORDER BY t.occurred_at DESC
        LIMIT $3`,
      [PartyType.MERCHANT, merchant.id, limit],
    );

    const plans = await this.subscriptions.find({
      where: { merchantId: merchant.id },
      relations: { machine: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const entries: MerchantTimelineEntry[] = [
      ...transfers.map((row) => ({
        kind: 'TRANSFER' as const,
        occurredAt: row.occurred_at,
        referenceNo: row.reference_no,
        machineSerial: row.serial,
        amount: null,
        code: row.direction === 'RETURN' ? 'RETURNED_MACHINE' : 'RECEIVED_MACHINE',
      })),
      ...plans.map((plan) => ({
        kind: 'SUBSCRIPTION_STARTED' as const,
        occurredAt: plan.createdAt,
        referenceNo: null,
        machineSerial: plan.machine?.serial ?? null,
        amount: Number(plan.amount),
        code: `PLAN_${plan.planType}`,
      })),
      // Only the most recent collection per plan is reconstructable until the finance ledger lands
      // in Phase 7 — the running total is a sum, not a log.
      ...plans
        .filter((plan) => plan.lastCollectedAt !== null)
        .map((plan) => ({
          kind: 'COLLECTION' as const,
          occurredAt: plan.lastCollectedAt!,
          referenceNo: null,
          machineSerial: plan.machine?.serial ?? null,
          amount: Number(plan.amount),
          code: 'COLLECTED',
        })),
    ];

    return entries.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit);
  }

  /**
   * The picker the transfer wizard opens for a `REPRESENTATIVE_TO_MERCHANT`. Scoped exactly as the
   * list is, so a representative is only ever offered shops he registered.
   */
  async pickable(scope: BranchScope, actor: AuthUser): Promise<Merchant[]> {
    const qb = this.baseQuery().andWhere('merchant.is_active = true');
    this.applyScope(qb, scope, actor);

    return qb.orderBy('merchant.name', 'ASC').take(200).getMany();
  }

  /** Whether a given id is a merchant the transfer engine may hand a machine to. */
  /**
   * Whether machines may be signed over to (or taken back from) this merchant.
   *
   * Pass `actor` to additionally require that the merchant is one this user may deal with —
   * the same three-level scope as the merchant list. Needed on the return leg, where the
   * merchant is derived from custody rather than picked from a scoped list.
   */
  async isDeliverable(id: string, manager?: EntityManager, actor?: AuthUser): Promise<boolean> {
    const repo = manager ? manager.getRepository(Merchant) : this.merchants;
    const merchant = await repo.findOne({ where: { id, isActive: true } });

    if (!merchant) return false;
    if (!actor) return true;

    return this.canSee(
      merchant,
      { branchId: actor.branchId, unrestricted: actor.branchId === null },
      actor,
    );
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private baseQuery(): SelectQueryBuilder<Merchant> {
    return this.merchants
      .createQueryBuilder('merchant')
      .leftJoinAndSelect('merchant.branch', 'branch');
  }

  private detailQuery(): SelectQueryBuilder<Merchant> {
    return this.baseQuery()
      .leftJoinAndSelect('merchant.registeredBy', 'registeredBy')
      .leftJoinAndSelect('merchant.subscriptions', 'subscription')
      .leftJoinAndSelect('subscription.machine', 'machine');
  }

  /**
   * Three levels, per `08`: the Director sees everything, a supervisor his branch, and a
   * representative only the shops he himself registered — his merchant list is his round, and
   * another representative's customers are not his to browse.
   */
  private applyScope(qb: SelectQueryBuilder<Merchant>, scope: BranchScope, actor: AuthUser): void {
    if (scope.unrestricted) return;

    qb.andWhere('merchant.branch_id = :scopeBranch', { scopeBranch: scope.branchId });

    if (actor.roleCode === SystemRole.REPRESENTATIVE) {
      qb.andWhere('merchant.created_by_user_id = :actorId', { actorId: actor.id });
    }
  }

  private canSee(merchant: Merchant, scope: BranchScope, actor: AuthUser): boolean {
    if (scope.unrestricted) return true;
    if (merchant.branchId !== scope.branchId) return false;

    return actor.roleCode !== SystemRole.REPRESENTATIVE || merchant.createdByUserId === actor.id;
  }

  private heldMachines(merchantId: string): Promise<Machine[]> {
    return this.dataSource.getRepository(Machine).find({
      where: {
        currentHolderType: PartyType.MERCHANT,
        currentHolderId: merchantId,
        status: MachineStatus.WITH_MERCHANT,
      },
      relations: { battery: true, machineModel: true, machineType: true, currentBranch: true },
      order: { serial: 'ASC' },
    });
  }

  private async countMachines(merchantId: string): Promise<number> {
    return this.dataSource.getRepository(Machine).count({
      where: {
        currentHolderType: PartyType.MERCHANT,
        currentHolderId: merchantId,
        status: MachineStatus.WITH_MERCHANT,
      },
    });
  }

  /** One grouped count for a whole page, rather than a query per row. */
  private async withCounts(merchants: Merchant[]): Promise<MerchantWithCount[]> {
    if (merchants.length === 0) return [];

    const rows = await this.dataSource
      .getRepository(Machine)
      .createQueryBuilder('machine')
      .select('machine.current_holder_id', 'merchantId')
      .addSelect('COUNT(*)', 'count')
      .where('machine.current_holder_type = :party', { party: PartyType.MERCHANT })
      .andWhere('machine.current_holder_id IN (:...ids)', {
        ids: merchants.map((merchant) => merchant.id),
      })
      .andWhere('machine.status = :status', { status: MachineStatus.WITH_MERCHANT })
      .groupBy('machine.current_holder_id')
      .getRawMany<{ merchantId: string; count: string }>();

    const byId = new Map(rows.map((row) => [row.merchantId, Number(row.count)]));

    return merchants.map((merchant) => ({
      merchant,
      machinesCount: byId.get(merchant.id) ?? 0,
    }));
  }

  private async assertNationalIdIsFree(nationalId?: string, exceptId?: string): Promise<void> {
    if (!nationalId) return;

    const existing = await this.merchants.findOne({ where: { nationalId } });

    if (existing && existing.id !== exceptId) {
      throw AppException.conflict(ErrorCode.DUPLICATE_NATIONAL_ID, { nationalId });
    }
  }

  private async assertMachineIsWithMerchant(machineId: string, merchantId: string): Promise<void> {
    const machine = await this.dataSource
      .getRepository(Machine)
      .findOne({ where: { id: machineId } });

    if (!machine) throw AppException.notFound(ErrorCode.MACHINE_NOT_FOUND);

    if (
      machine.currentHolderType !== PartyType.MERCHANT ||
      machine.currentHolderId !== merchantId
    ) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'machineId', value: machineId, constraint: 'not with this merchant' }],
      });
    }
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

  private async loadSubscription(id: string): Promise<MerchantSubscription> {
    const subscription = await this.subscriptions.findOne({
      where: { id },
      relations: { machine: true },
    });

    if (!subscription) throw AppException.notFound(ErrorCode.NOT_FOUND);

    return subscription;
  }

  /**
   * A subscription is only reachable through a merchant the caller may already see. The merchant
   * comes back with it because that is where the branch lives — a plan carries no branch of its
   * own, and the income it produces has to be booked against one.
   */
  private async loadSubscriptionScoped(
    id: string,
    scope: BranchScope,
    actor: AuthUser,
  ): Promise<{ subscription: MerchantSubscription; merchant: Merchant }> {
    const subscription = await this.loadSubscription(id);
    const { merchant } = await this.findById(subscription.merchantId, scope, actor);

    return { subscription, merchant };
  }
}

/**
 * When the first payment is expected. A `NONE` plan never generates one, and a one-off fee is due
 * on the start date and then never again — `rollDueDate` is what clears it.
 */
function firstDueDate(planType: SubscriptionPlanType, startDate: string): string | null {
  return planType === SubscriptionPlanType.NONE ? null : startDate;
}

/**
 * Rolls forward from the *due* date rather than from today: a merchant who pays a week late still
 * owes the following month on the first, and anchoring to the payment date would silently give him
 * a longer month every time he was late.
 */
function rollDueDate(subscription: MerchantSubscription): string | null {
  if (subscription.planType === SubscriptionPlanType.ONE_TIME_FEE) return null;
  if (subscription.planType === SubscriptionPlanType.NONE) return null;

  const anchor = new Date(`${subscription.nextDueDate ?? subscription.startDate}T00:00:00.000Z`);

  const days = PERIOD_DAYS[subscription.planType];
  if (days !== undefined) {
    anchor.setUTCDate(anchor.getUTCDate() + days);
  } else {
    // Monthly. `setUTCMonth` clamps 31 January + 1 month to 3 March, so the day is pinned back
    // to the end of the shorter month instead of skipping it.
    const day = anchor.getUTCDate();
    anchor.setUTCDate(1);
    anchor.setUTCMonth(anchor.getUTCMonth() + 1);
    anchor.setUTCDate(Math.min(day, daysInMonth(anchor.getUTCFullYear(), anchor.getUTCMonth())));
  }

  const next = anchor.toISOString().slice(0, 10);

  // A plan that has reached its end date stops generating dues rather than running past it.
  return subscription.endDate && next > subscription.endDate ? null : next;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}
