import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { DEFAULT_LOCALE, Locale } from 'src/common/constants/locales';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import { FinanceKind, TransactionSource } from 'src/common/enums/finance.enum';
import {
  NotificationEntityType,
  NotificationTemplateCode,
} from 'src/common/enums/notification.enum';
import { Severity, ViolationStatus } from 'src/common/enums/operations.enum';
import { PartyType, TransferDirection, TransferStatus } from 'src/common/enums/transfer.enum';
import { AppException } from 'src/common/errors';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import { joinTranslation, pickTranslation } from 'src/common/utils';
import { BusinessConfig } from 'src/config/business.config';
import { SystemCategoryCode } from 'src/modules/finance/services/finance-categories.service';
import {
  FinancePostingService,
  FinanceSourceRefType,
} from 'src/modules/finance/services/finance-posting.service';
import { PaymentMethod } from 'src/modules/lookups/entities/payment-method.entity';
import { ViolationType } from 'src/modules/lookups/entities/violation-type.entity';
import { NotificationDispatcherService } from 'src/modules/notifications/services/notification-dispatcher.service';
import {
  dedupe as dedupeRecipients,
  NotificationRecipientsService,
} from 'src/modules/notifications/services/notification-recipients.service';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { Transfer } from 'src/modules/transfers/entities/transfer.entity';
import { TransferItem } from 'src/modules/transfers/entities/transfer-item.entity';
import { User } from 'src/modules/users/entities/user.entity';
import {
  ChargeViolationDto,
  CreateViolationDto,
  QueryViolationsDto,
  UpdateViolationDto,
  WaiveViolationDto,
} from './dto/violation.dto';
import {
  ViolationByTypeResponse,
  ViolationMonthResponse,
  ViolationSummaryResponse,
} from './dto/responses/violation.response';
import { Violation } from './entities/violation.entity';
import { detectViolations, OutboundBaseline, ViolationCode } from './violation-rules';

/** What the transfer engine hands over when a return leg confirms. */
export interface DetectionContext {
  transfer: Transfer;
  items: TransferItem[];
  /** Who is held responsible: the party handing the machines back. */
  responsibleUserId: string;
  actorId: string;
}

/** What a maintenance close hands over when the representative is billed for the repair (`11`). */
export interface MaintenanceViolationContext {
  userId: string;
  machineId: string;
  branchId: string | null;
  amount: number;
  severity: Severity;
  description: string;
  actorId: string;
}

/** The columns a violation notification needs, flattened out of the joins that produce them. */
interface NotifiableViolation {
  id: string;
  user_id: string;
  branch_id: string | null;
  severity: Severity;
  type_name: string;
  serial: string;
}

const MONTHS_ON_THE_CHART = 12;
const TREND_WINDOW_MONTHS = 6;

/** A change of at least this many entries between the two halves is called a trend, not noise. */
const TREND_THRESHOLD = 1;

@Injectable()
export class ViolationsService {
  private readonly business: BusinessConfig;

  constructor(
    @InjectRepository(Violation) private readonly violations: Repository<Violation>,
    @InjectRepository(ViolationType) private readonly types: Repository<ViolationType>,
    private readonly posting: FinancePostingService,
    private readonly notifications: NotificationDispatcherService,
    private readonly recipients: NotificationRecipientsService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.business = config.getOrThrow<BusinessConfig>('business');
  }

  async findAll(
    query: QueryViolationsDto,
    scope: BranchScope,
    actor: AuthUser,
    locale: Locale,
  ): Promise<PaginatedResult<Violation>> {
    const qb = this.baseQuery(locale);

    this.applyScope(qb, scope, actor);

    if (query.userId) qb.andWhere('violation.user_id = :userId', { userId: query.userId });
    if (query.machineId) {
      qb.andWhere('violation.machine_id = :machineId', { machineId: query.machineId });
    }
    if (query.typeId) {
      qb.andWhere('violation.violation_type_id = :typeId', { typeId: query.typeId });
    }
    if (scope.unrestricted && query.branchId) {
      qb.andWhere('violation.branch_id = :branchId', { branchId: query.branchId });
    }
    if (query.severity?.length) {
      qb.andWhere('violation.severity IN (:...severities)', { severities: query.severity });
    }
    if (query.status?.length) {
      qb.andWhere('violation.status IN (:...statuses)', { statuses: query.status });
    }
    if (query.dateFrom) {
      qb.andWhere('violation.created_at >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('violation.created_at <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.autoGenerated !== undefined) {
      qb.andWhere('violation.auto_generated = :auto', { auto: query.autoGenerated });
    }

    qb.orderBy(`violation.${query.sortBy}`, query.order).addOrderBy('violation.id', 'ASC');
    qb.skip(query.skip).take(query.take);

    const [rows, total] = await qb.getManyAndCount();
    return new PaginatedResult(rows, total, query.page, query.limit);
  }

  async findById(
    id: string,
    scope: BranchScope,
    actor: AuthUser,
    locale: Locale,
  ): Promise<Violation> {
    const violation = await this.baseQuery(locale).where('violation.id = :id', { id }).getOne();

    if (!violation || !this.canSee(violation, scope, actor)) {
      throw AppException.notFound(ErrorCode.NOT_FOUND);
    }

    return violation;
  }

  /** A manually filed violation — the supervisor saw something the scanner could not. */
  async create(
    dto: CreateViolationDto,
    scope: BranchScope,
    actor: AuthUser,
    locale: Locale,
  ): Promise<Violation> {
    // Filed in a shop with no signal and submitted twice on the way back (`20`, mechanism 1).
    // Scoped to the filer so a leaked id cannot be used to read someone's disciplinary record.
    if (dto.clientUuid) {
      const replayed = await this.violations.findOne({
        where: { clientUuid: dto.clientUuid, createdBy: actor.id },
      });

      if (replayed) {
        return this.findById(replayed.id, { branchId: null, unrestricted: true }, actor, locale);
      }
    }

    const type = await this.types.findOne({ where: { id: dto.violationTypeId } });
    if (!type) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          { field: 'violationTypeId', value: dto.violationTypeId, constraint: 'unknown type' },
        ],
      });
    }

    const subject = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: dto.userId } });

    if (!subject) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'userId', value: dto.userId, constraint: 'unknown user' }],
      });
    }

    // A branch-scoped supervisor files against his own staff. Every read path scopes
    // carefully; writing across branches would let him put a violation on another
    // branch's disciplinary file.
    if (!scope.unrestricted && subject.branchId !== scope.branchId) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'userId', value: dto.userId, constraint: 'outside your branch' }],
      });
    }

    const created = await this.violations.save(
      this.violations.create({
        violationTypeId: type.id,
        userId: subject.id,
        machineId: dto.machineId ?? null,
        transferItemId: dto.transferItemId ?? null,
        branchId: subject.branchId,
        severity: dto.severity,
        description: dto.description,
        status: ViolationStatus.OPEN,
        autoGenerated: false,
        clientUuid: dto.clientUuid ?? null,
        createdBy: actor.id,
      }),
    );

    await this.notifyCreated([created.id], actor.id);

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.VIOLATION_CREATED,
      entityType: AuditEntityType.VIOLATION,
      entityId: created.id,
      after: { userId: subject.id, violationTypeId: type.id, severity: dto.severity },
    });

    return this.findById(created.id, { branchId: null, unrestricted: true }, actor, locale);
  }

  /**
   * Revise a manually filed violation. Auto-generated rows are refused outright: a detected
   * mismatch that a supervisor can rewrite afterwards proves nothing, and the argument it was
   * meant to settle would simply be had again with the record as the disputed exhibit.
   */
  async update(
    id: string,
    dto: UpdateViolationDto,
    scope: BranchScope,
    actor: AuthUser,
    locale: Locale,
  ): Promise<Violation> {
    const violation = await this.findById(id, scope, actor, locale);

    const editsContent = dto.severity !== undefined || dto.description !== undefined;

    if (violation.autoGenerated && editsContent) {
      throw AppException.unprocessable(ErrorCode.AUTO_VIOLATION_IMMUTABLE);
    }

    if (this.isSettled(violation)) {
      throw AppException.conflict(ErrorCode.ALREADY_CHARGED, { id });
    }

    // CLOSED is an end state. Reopening it as ACKNOWLEDGED would walk the record backwards,
    // and `isSettled` only covers the money statuses.
    if (
      dto.status === ViolationStatus.ACKNOWLEDGED &&
      violation.status === ViolationStatus.CLOSED
    ) {
      throw AppException.unprocessable(ErrorCode.VALIDATION_FAILED, { id });
    }

    await this.violations.update(id, {
      ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.status !== undefined ? this.statusPatch(dto.status, actor.id) : {}),
      updatedBy: actor.id,
    });

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.VIOLATION_UPDATED,
      entityType: AuditEntityType.VIOLATION,
      entityId: id,
      before: { severity: violation.severity, description: violation.description },
      after: {
        severity: dto.severity ?? violation.severity,
        description: dto.description ?? violation.description,
      },
    });

    return this.findById(id, scope, actor, locale);
  }

  /**
   * Marks it read. Available to the representative himself, which is why it is separate from
   * `update` — acknowledging a violation is not resolving it, and he holds no `violations.resolve`.
   */
  async acknowledge(
    id: string,
    scope: BranchScope,
    actor: AuthUser,
    locale: Locale,
  ): Promise<Violation> {
    const violation = await this.findById(id, scope, actor, locale);

    // Acknowledgement is the subject saying "I have seen this". A colleague cannot make
    // that statement on his behalf, and it would be worthless as a record if they could.
    if (violation.userId !== actor.id) {
      throw AppException.forbidden(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    if (violation.status === ViolationStatus.OPEN) {
      await this.violations.update(id, {
        status: ViolationStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        updatedBy: actor.id,
      });

      await this.audit.record({
        userId: actor.id,
        action: AuditAction.VIOLATION_ACKNOWLEDGED,
        entityType: AuditEntityType.VIOLATION,
        entityId: id,
        before: { status: ViolationStatus.OPEN },
        after: { status: ViolationStatus.ACKNOWLEDGED },
      });
    }

    return this.findById(id, scope, actor, locale);
  }

  /**
   * The only way a violation produces money.
   *
   * The charge and its income row commit together: a violation marked charged with no entry in
   * the ledger is money the company believes it collected and cannot find, and the reverse is an
   * income row nobody can explain. `VIOLATION_CHARGES` is resolved by code, and the violation's
   * own id is the posting's identity — so a replayed charge finds the row it already wrote
   * instead of booking the fine twice.
   */
  async charge(
    id: string,
    dto: ChargeViolationDto,
    scope: BranchScope,
    actor: AuthUser,
    locale: Locale,
  ): Promise<Violation> {
    const violation = await this.findById(id, scope, actor, locale);

    if (violation.status === ViolationStatus.CHARGED) {
      throw AppException.conflict(ErrorCode.ALREADY_CHARGED, { id });
    }

    if (violation.status === ViolationStatus.WAIVED) {
      throw AppException.unprocessable(ErrorCode.VALIDATION_FAILED, { id });
    }

    await this.assertPaymentMethod(dto.paymentMethodId);

    await this.dataSource.transaction(async (manager) => {
      const posted = await this.posting.post(
        {
          kind: FinanceKind.INCOME,
          amount: dto.amount,
          categoryCode: SystemCategoryCode.VIOLATION_CHARGES,
          transactionDate: new Date(dto.chargedAt),
          paymentMethodId: dto.paymentMethodId,
          branchId: violation.branchId,
          source: TransactionSource.AUTO_VIOLATION,
          sourceRefType: FinanceSourceRefType.VIOLATION,
          sourceRefId: violation.id,
          notes: violation.description,
          actorId: actor.id,
        },
        manager,
      );

      // Conditional on the status still being unsettled. The read above is not a guarantee:
      // two concurrent charges would both pass it and the second would silently overwrite
      // the first amount while a second income row sat in the ledger.
      const settled = await manager.getRepository(Violation).update(
        { id, status: In([ViolationStatus.OPEN, ViolationStatus.ACKNOWLEDGED]) },
        {
          status: ViolationStatus.CHARGED,
          chargedAmount: String(dto.amount),
          paymentMethodId: dto.paymentMethodId,
          chargedAt: new Date(dto.chargedAt),
          financeTransactionId: posted.id,
          resolvedByUserId: actor.id,
          resolvedAt: new Date(),
          updatedBy: actor.id,
        },
      );

      if (!settled.affected) {
        // Rolls back the posting with it — a charge and its income row are one fact.
        throw AppException.conflict(ErrorCode.ALREADY_CHARGED, { id });
      }
    });

    await this.notifyCharged(id, dto.amount, actor.id);

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.VIOLATION_CHARGED,
      entityType: AuditEntityType.VIOLATION,
      entityId: id,
      before: { status: violation.status },
      after: { status: ViolationStatus.CHARGED, chargedAmount: String(dto.amount) },
    });

    return this.findById(id, scope, actor, locale);
  }

  /** Forgiven, with a reason, and kept. A waived violation still counts on the man's file. */
  async waive(
    id: string,
    dto: WaiveViolationDto,
    scope: BranchScope,
    actor: AuthUser,
    locale: Locale,
  ): Promise<Violation> {
    const violation = await this.findById(id, scope, actor, locale);

    if (violation.status === ViolationStatus.CHARGED) {
      throw AppException.conflict(ErrorCode.ALREADY_CHARGED, { id });
    }

    // Same atomicity as `charge`: a waive racing a charge must lose rather than overwrite a
    // fine that has already been posted to the ledger.
    const waived = await this.violations.update(
      { id, status: In([ViolationStatus.OPEN, ViolationStatus.ACKNOWLEDGED]) },
      {
        status: ViolationStatus.WAIVED,
        waiverReason: dto.reason,
        resolvedByUserId: actor.id,
        resolvedAt: new Date(),
        updatedBy: actor.id,
      },
    );

    if (!waived.affected) {
      throw AppException.conflict(ErrorCode.ALREADY_CHARGED, { id });
    }

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.VIOLATION_WAIVED,
      entityType: AuditEntityType.VIOLATION,
      entityId: id,
      before: { status: violation.status },
      after: { status: ViolationStatus.WAIVED, reason: dto.reason },
    });

    return this.findById(id, scope, actor, locale);
  }

  async summary(
    userId: string,
    scope: BranchScope,
    actor: AuthUser,
    locale: Locale,
  ): Promise<ViolationSummaryResponse> {
    const subject = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });

    if (!subject) throw AppException.notFound(ErrorCode.NOT_FOUND);

    if (!scope.unrestricted && subject.id !== actor.id && subject.branchId !== scope.branchId) {
      throw AppException.notFound(ErrorCode.NOT_FOUND);
    }

    const rows = await this.baseQuery(locale)
      .where('violation.user_id = :userId', { userId })
      .orderBy('violation.created_at', 'DESC')
      .getMany();

    // `User` carries no branch relation, so the name is read on its own rather than joined.
    const branch = subject.branchId
      ? await this.dataSource.getRepository(Branch).findOne({ where: { id: subject.branchId } })
      : null;

    return {
      user: { id: subject.id, fullName: subject.fullName },
      branch: branch?.name ?? null,
      totals: {
        all: rows.length,
        open: rows.filter((row) => row.status === ViolationStatus.OPEN).length,
        charged: rows.filter((row) => row.status === ViolationStatus.CHARGED).length,
        waived: rows.filter((row) => row.status === ViolationStatus.WAIVED).length,
      },
      byType: this.groupByType(rows, locale),
      bySeverity: {
        [Severity.HIGH]: rows.filter((row) => row.severity === Severity.HIGH).length,
        [Severity.MEDIUM]: rows.filter((row) => row.severity === Severity.MEDIUM).length,
        [Severity.LOW]: rows.filter((row) => row.severity === Severity.LOW).length,
      },
      totalCharged: rows.reduce((sum, row) => sum + Number(row.chargedAmount ?? 0), 0),
      last12Months: this.monthlyCounts(rows),
      trend: this.trendOf(rows),
    };
  }

  /**
   * Runs on confirm of any return leg whose rule sets `runViolationChecks` (`10`).
   *
   * Called from inside the transfer's own transaction, so a violation and the custody move it
   * describes commit together — a hand-off that succeeded while its violation was lost would leave
   * the representative holding a clean record for a machine he damaged.
   */
  async detectFor(context: DetectionContext, manager: EntityManager): Promise<Violation[]> {
    const types = await this.typeIdsByCode(manager);
    const repo = manager.getRepository(Violation);
    const created: Violation[] = [];
    const now = new Date();

    for (const item of context.items) {
      const baseline = await this.outboundBaseline(
        manager,
        item.machineId,
        context.responsibleUserId,
        context.transfer.id,
      );

      const expectedBatterySerial = await this.bondedBatterySerial(manager, item.machineId);

      const detected = detectViolations({
        item,
        baseline,
        idleAlertDays: this.business.idleAlertDays,
        expectedBatterySerial,
        now,
        // On a merchant return the baseline is the outbound leg to the *merchant*, so the
        // elapsed days measure how long the shop kept the machine. Charging the
        // representative for that would file a violation on every long placement.
        checkLateReturn: context.transfer.fromPartyType !== PartyType.MERCHANT,
      });

      for (const finding of detected) {
        const typeId = types.get(finding.code);
        // A code with no seeded type is a seeding gap, not a reason to fail the hand-off the
        // representative is standing there waiting for.
        if (!typeId) continue;

        // The partial unique index is the real guard against a replayed confirm; this keeps the
        // common case out of the error path.
        const existing = await repo.findOne({
          where: { transferItemId: item.id, violationTypeId: typeId, autoGenerated: true },
        });
        if (existing) continue;

        created.push(
          await repo.save(
            repo.create({
              violationTypeId: typeId,
              userId: context.responsibleUserId,
              machineId: item.machineId,
              transferId: context.transfer.id,
              transferItemId: item.id,
              branchId: context.transfer.branchId,
              severity: finding.severity,
              description: finding.description,
              status: ViolationStatus.OPEN,
              autoGenerated: true,
              createdBy: context.actorId,
            }),
          ),
        );
      }
    }

    return created;
  }

  /**
   * A repair charged to the representative who broke the machine (`11`, step 4).
   *
   * Routed through a violation rather than an income row on purpose: money owed by a
   * representative has exactly one path to the ledger, `charge`, so it is realised when it is
   * actually collected and shows up on his disciplinary file either way. Filed as
   * `ACKNOWLEDGED` because the close conversation is where he was told.
   *
   * Runs on the maintenance transaction's manager: a closed order pointing at a violation that
   * was rolled back would bill nobody and blame somebody.
   */
  async createFromMaintenance(
    context: MaintenanceViolationContext,
    manager: EntityManager,
  ): Promise<Violation> {
    const types = await this.typeIdsByCode(manager);
    const typeId = types.get(ViolationCode.PHYSICAL_DAMAGE);

    if (!typeId) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          {
            field: 'responsibleParty',
            value: ViolationCode.PHYSICAL_DAMAGE,
            constraint: 'no active violation type is seeded for maintenance damage',
          },
        ],
      });
    }

    const subject = await manager.getRepository(User).findOne({ where: { id: context.userId } });

    if (!subject) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          { field: 'responsibleUserId', value: context.userId, constraint: 'unknown user' },
        ],
      });
    }

    const repo = manager.getRepository(Violation);

    return repo.save(
      repo.create({
        violationTypeId: typeId,
        userId: subject.id,
        machineId: context.machineId,
        branchId: context.branchId ?? subject.branchId,
        severity: context.severity,
        description: context.description,
        status: ViolationStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        // The amount is already decided — it is the repair bill — but it is not money yet.
        chargedAmount: String(context.amount),
        autoGenerated: true,
        createdBy: context.actorId,
      }),
    );
  }

  /**
   * `18`: a violation reaches the representative it is filed against and his supervisor.
   *
   * Called with ids rather than entities, and *after* the writing transaction rather than inside
   * it: the two callers that produce auto-generated rows — a confirmed return leg and a
   * maintenance close — both write in a transaction that may still roll back, and a notification
   * about a violation that never existed cannot be taken back.
   */
  async notifyCreated(violationIds: readonly string[], actorId: string): Promise<void> {
    for (const row of await this.describe(violationIds)) {
      const subject = await this.recipients.byId(row.user_id);
      const supervisors = await this.recipients.branchSupervisors(row.branch_id);
      const audience = dedupeRecipients([...(subject ? [subject] : []), ...supervisors]);

      if (audience.length === 0) continue;

      await this.notifications.tryDispatch({
        templateCode: NotificationTemplateCode.VIOLATION_CREATED,
        recipients: audience,
        params: {
          violationType: row.type_name,
          machineSerial: row.serial,
          severity: row.severity,
        },
        entityType: NotificationEntityType.VIOLATION,
        entityId: row.id,
        actorId,
      });
    }
  }

  /** `18`: the money is the representative's business and nobody else's. */
  async notifyCharged(violationId: string, amount: number, actorId: string): Promise<void> {
    const [row] = await this.describe([violationId]);
    if (!row) return;

    const subject = await this.recipients.byId(row.user_id);
    if (!subject) return;

    await this.notifications.tryDispatch({
      templateCode: NotificationTemplateCode.VIOLATION_CHARGED,
      recipients: [subject],
      params: { violationType: row.type_name, amount: amount.toFixed(2) },
      entityType: NotificationEntityType.VIOLATION,
      entityId: row.id,
      actorId,
    });
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /**
   * The handful of fields a notification body needs, for a batch of violations at once.
   *
   * The type name is read in the default locale rather than the recipient's: one dispatch renders
   * one set of parameters for everybody it reaches, and Arabic is the primary locale (`02`).
   */
  private describe(ids: readonly string[]): Promise<NotifiableViolation[]> {
    if (ids.length === 0) return Promise.resolve([]);

    return this.violations.query<NotifiableViolation[]>(
      `SELECT v.id, v.user_id, v.branch_id, v.severity,
              COALESCE(vtt.name, vt.code) AS type_name,
              COALESCE(m.serial, '—') AS serial
         FROM violations v
         JOIN violation_types vt ON vt.id = v.violation_type_id
         LEFT JOIN violation_type_translations vtt
                ON vtt.violation_type_id = vt.id AND vtt.locale = $2
         LEFT JOIN machines m ON m.id = v.machine_id
        WHERE v.id = ANY($1::uuid[])`,
      [[...ids], DEFAULT_LOCALE],
    );
  }

  private baseQuery(locale: Locale): SelectQueryBuilder<Violation> {
    const qb = this.violations
      .createQueryBuilder('violation')
      .leftJoinAndSelect('violation.violationType', 'type')
      .leftJoinAndSelect('violation.user', 'user')
      .leftJoinAndSelect('violation.machine', 'machine');

    joinTranslation(qb, 'type', 'translations', locale);

    return qb;
  }

  /**
   * A representative always sees his own file, whatever else he can or cannot read — being told
   * you have a violation and not being able to open it is not a workable disciplinary process.
   * Everyone else is held to their branch unless they hold `violations.read.all`.
   */
  private applyScope(qb: SelectQueryBuilder<Violation>, scope: BranchScope, actor: AuthUser): void {
    if (scope.unrestricted) return;

    qb.andWhere('(violation.branch_id = :scopeBranch OR violation.user_id = :actorId)', {
      scopeBranch: scope.branchId,
      actorId: actor.id,
    });
  }

  private canSee(violation: Violation, scope: BranchScope, actor: AuthUser): boolean {
    if (scope.unrestricted) return true;

    return violation.branchId === scope.branchId || violation.userId === actor.id;
  }

  /** Charged and waived are both terminal: the money question has been answered either way. */
  private isSettled(violation: Violation): boolean {
    return (
      violation.status === ViolationStatus.CHARGED || violation.status === ViolationStatus.WAIVED
    );
  }

  private statusPatch(status: ViolationStatus, actorId: string): Partial<Violation> {
    if (status === ViolationStatus.ACKNOWLEDGED) {
      return { status, acknowledgedAt: new Date() };
    }

    return { status, resolvedByUserId: actorId, resolvedAt: new Date() };
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

  private async typeIdsByCode(manager: EntityManager): Promise<Map<string, string>> {
    const types = await manager.getRepository(ViolationType).find({ where: { isActive: true } });
    return new Map(types.map((type) => [type.code, type.id]));
  }

  private async bondedBatterySerial(
    manager: EntityManager,
    machineId: string,
  ): Promise<string | null> {
    const rows = await manager.query<Array<{ serial: string }>>(
      `SELECT serial FROM batteries WHERE machine_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [machineId],
    );

    return rows[0]?.serial ?? null;
  }

  /**
   * What this man was handed, taken from the last confirmed *outbound* item for this machine to
   * this person — `getLastOutboundItem` in `10`.
   *
   * The current transfer is excluded explicitly: on an auto-confirmed return leg the row being
   * confirmed already exists by the time the detector runs, and it would otherwise be compared
   * against itself and find nothing wrong with anything.
   */
  private async outboundBaseline(
    manager: EntityManager,
    machineId: string,
    userId: string,
    exceptTransferId: string,
  ): Promise<OutboundBaseline | null> {
    const item = await manager
      .getRepository(TransferItem)
      .createQueryBuilder('item')
      .innerJoin('item.transfer', 'transfer')
      .where('item.machine_id = :machineId', { machineId })
      .andWhere('transfer.status = :confirmed', { confirmed: TransferStatus.CONFIRMED })
      .andWhere('transfer.direction = :out', { out: TransferDirection.OUT })
      .andWhere('transfer.id != :exceptId', { exceptId: exceptTransferId })
      // Whoever the machine was handed *to* is the man who now has to answer for it. A
      // representative taking a machine from a merchant is answering for what he gave the merchant.
      .andWhere('(transfer.to_party_id = :userId OR transfer.initiated_by_user_id = :userId)', {
        userId,
      })
      .orderBy('transfer.occurred_at', 'DESC')
      .getOne();

    if (!item) return null;

    const transfer = await manager
      .getRepository(Transfer)
      .findOne({ where: { id: item.transferId } });

    return {
      hasCharger: item.hasCharger,
      hasBox: item.hasBox,
      condition: item.condition,
      issuedAt: transfer?.occurredAt ?? item.createdAt,
    };
  }

  private groupByType(rows: Violation[], locale: Locale): ViolationByTypeResponse[] {
    const groups = new Map<string, ViolationByTypeResponse>();

    for (const row of rows) {
      const code = row.violationType.code;
      const entry = groups.get(code) ?? {
        code,
        name: pickTranslation(row.violationType.translations, locale)?.name ?? code,
        count: 0,
        chargedAmount: 0,
      };

      entry.count += 1;
      entry.chargedAmount += Number(row.chargedAmount ?? 0);
      groups.set(code, entry);
    }

    return [...groups.values()].sort((a, b) => b.count - a.count);
  }

  /** Twelve buckets, oldest first, including the empty ones — a gap in a chart is information. */
  private monthlyCounts(rows: Violation[], now = new Date()): ViolationMonthResponse[] {
    const buckets = new Map<string, number>();

    for (let index = MONTHS_ON_THE_CHART - 1; index >= 0; index -= 1) {
      const point = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
      buckets.set(point.toISOString().slice(0, 7), 0);
    }

    for (const row of rows) {
      const month = row.createdAt.toISOString().slice(0, 7);
      if (buckets.has(month)) buckets.set(month, buckets.get(month)! + 1);
    }

    return [...buckets.entries()].map(([month, count]) => ({ month, count }));
  }

  /** The last six months against the six before them. Fewer entries is improving. */
  private trendOf(rows: Violation[], now = new Date()): string {
    const months = this.monthlyCounts(rows, now);

    const recent = months.slice(TREND_WINDOW_MONTHS).reduce((sum, month) => sum + month.count, 0);
    const earlier = months
      .slice(0, TREND_WINDOW_MONTHS)
      .reduce((sum, month) => sum + month.count, 0);

    if (recent <= earlier - TREND_THRESHOLD) return 'IMPROVING';
    if (recent >= earlier + TREND_THRESHOLD) return 'WORSENING';

    return 'STEADY';
  }
}
