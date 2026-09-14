import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { Locale } from 'src/common/constants/locales';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import { FinanceKind, TransactionSource } from 'src/common/enums/finance.enum';
import { MachineStatus, TERMINAL_MACHINE_STATUSES } from 'src/common/enums/machine-status.enum';
import {
  MaintenanceResult,
  MaintenanceStatus,
  MediaPurpose,
  OPEN_MAINTENANCE_STATUSES,
  ResponsibleParty,
  Severity,
  WarehouseType,
} from 'src/common/enums/operations.enum';
import {
  NotificationEntityType,
  NotificationTemplateCode,
} from 'src/common/enums/notification.enum';
import { ItemCondition, TransferStatus } from 'src/common/enums/transfer.enum';
import { AppException } from 'src/common/errors';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import {
  deterministicUuid,
  joinTranslation,
  nextReferenceNo,
  ReferencePrefix,
} from 'src/common/utils';
import { SystemCategoryCode } from 'src/modules/finance/services/finance-categories.service';
import {
  FinancePostingService,
  FinanceSourceRefType,
} from 'src/modules/finance/services/finance-posting.service';
import { MaintenanceLocation } from 'src/modules/lookups/entities/maintenance-location.entity';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { MediaService } from 'src/modules/media/media.service';
import { MerchantsService } from 'src/modules/merchants/merchants.service';
import { NotificationDispatcherService } from 'src/modules/notifications/services/notification-dispatcher.service';
import { NotificationRecipientsService } from 'src/modules/notifications/services/notification-recipients.service';
import { Warehouse } from 'src/modules/organization/entities/warehouse.entity';
import { ReplacementMachineDto } from 'src/modules/replacements/dto/replacement.dto';
import { ReplacementsService } from 'src/modules/replacements/replacements.service';
import { CreateTransferDto, SignatureDto } from 'src/modules/transfers/dto/transfer.dto';
import { TransfersService } from 'src/modules/transfers/transfers.service';
import { ViolationsService } from 'src/modules/violations/violations.service';
import {
  CancelMaintenanceOrderDto,
  CloseMaintenanceOrderDto,
  CreateMaintenanceOrderDto,
  QueryMachineMaintenanceHistoryDto,
  QueryMaintenanceOrdersDto,
  ReceiveMaintenanceOrderDto,
  SendMaintenanceOrderDto,
  UpdateMaintenanceOrderDto,
} from './dto/maintenance.dto';
import { MaintenanceOrder } from './entities/maintenance-order.entity';
import {
  MaintenanceRoute,
  MaintenanceTotals,
  routeFor,
  suggestFreeUnderWarranty,
} from './maintenance-rules';

export interface MaintenanceActor {
  user: AuthUser;
  ipAddress: string | null;
}

export interface CloseOutcome {
  order: MaintenanceOrder;
  /** The unit that came back in its place, when the order closed as a swap. */
  replacementMachineId: string | null;
}

/**
 * Maintenance orders (`11`) — the fault, where the machine went, what it cost, and who pays.
 *
 * Two things in here are load-bearing. One open order per machine (rule 1) is held by the row lock
 * this service takes on the machine before it inserts *and* by `uq_machine_open_maintenance`, the
 * same belt-and-braces the transfer engine uses for "not already in transit". And the close flow
 * runs as a single transaction whose money artefact — expense, violation or one-off fee — commits
 * with the order or not at all; the expense is keyed on the order's own id, so closing twice cannot
 * post twice even if the status check were somehow bypassed.
 */
@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceOrder) private readonly orders: Repository<MaintenanceOrder>,
    private readonly transfers: TransfersService,
    private readonly posting: FinancePostingService,
    private readonly violations: ViolationsService,
    private readonly merchants: MerchantsService,
    private readonly replacements: ReplacementsService,
    private readonly media: MediaService,
    private readonly notifications: NotificationDispatcherService,
    private readonly recipients: NotificationRecipientsService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    query: QueryMaintenanceOrdersDto,
    scope: BranchScope,
    locale: Locale,
  ): Promise<PaginatedResult<MaintenanceOrder>> {
    const qb = this.baseQuery(locale);

    if (!scope.unrestricted) {
      qb.andWhere('order.branch_id = :scopeBranch', { scopeBranch: scope.branchId });
    } else if (query.branchId) {
      qb.andWhere('order.branch_id = :branchId', { branchId: query.branchId });
    }

    if (query.machineId)
      qb.andWhere('order.machine_id = :machineId', { machineId: query.machineId });
    if (query.status?.length) {
      qb.andWhere('order.status IN (:...statuses)', { statuses: query.status });
    }
    if (query.locationId) {
      qb.andWhere('order.maintenance_location_id = :locationId', { locationId: query.locationId });
    }
    if (query.responsibleParty) {
      qb.andWhere('order.responsible_party = :party', { party: query.responsibleParty });
    }
    if (query.dateFrom) qb.andWhere('order.sent_at >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('order.sent_at <= :dateTo', { dateTo: query.dateTo });
    if (query.isFreeUnderWarranty !== undefined) {
      qb.andWhere('order.is_free_under_warranty = :free', { free: query.isFreeUnderWarranty });
    }

    qb.orderBy(`order.${query.sortBy}`, query.order).addOrderBy('order.id', 'ASC');
    qb.skip(query.skip).take(query.take);

    const [rows, total] = await qb.getManyAndCount();

    return new PaginatedResult(rows, total, query.page, query.limit);
  }

  async findById(id: string, scope: BranchScope, locale: Locale): Promise<MaintenanceOrder> {
    const order = await this.baseQuery(locale).andWhere('order.id = :id', { id }).getOne();

    if (!order) throw AppException.notFound(ErrorCode.MAINTENANCE_ORDER_NOT_FOUND, { id });

    // A branch-scoped supervisor sees his branch's repairs. An order for a machine sitting in the
    // company warehouse carries no branch, and is management's business rather than his.
    if (!scope.unrestricted && order.branchId !== scope.branchId) {
      throw AppException.notFound(ErrorCode.MAINTENANCE_ORDER_NOT_FOUND, { id });
    }

    return order;
  }

  /**
   * Opens the order. The machine is locked first: two supervisors reporting the same fault from
   * two phones must not both get an order, and the check that stops them is only worth anything
   * if the row cannot change under it.
   */
  async create(
    dto: CreateMaintenanceOrderDto,
    actor: MaintenanceActor,
    locale: Locale,
  ): Promise<MaintenanceOrder> {
    // Without this, a submit sent twice off a flaky connection is refused the second time as
    // `MACHINE_ALREADY_IN_MAINTENANCE` — by the order the first attempt had already opened.
    if (dto.clientUuid) {
      const replayed = await this.orders.findOne({
        where: { clientUuid: dto.clientUuid, createdBy: actor.user.id },
      });

      if (replayed)
        return this.findById(replayed.id, { branchId: null, unrestricted: true }, locale);
    }

    const id = await this.dataSource.transaction(async (manager) => {
      const machine = await this.lockMachine(manager, dto.machineId);

      this.assertMaintainable(machine);
      await this.assertNoOpenOrder(manager, machine.id);

      const location = await this.requireLocation(manager, dto.locationId);
      const sentAt = new Date(dto.sentAt);

      const repo = manager.getRepository(MaintenanceOrder);
      const order = await repo.save(
        repo.create({
          referenceNo: await nextReferenceNo(manager, ReferencePrefix.MAINTENANCE),
          machineId: machine.id,
          maintenanceLocationId: location.id,
          branchId: machine.currentBranchId,
          reportedFault: dto.reportedFault,
          sentAt,
          status: MaintenanceStatus.OPEN,
          suggestedFreeUnderWarranty: suggestFreeUnderWarranty(machine, sentAt),
          notes: dto.notes ?? null,
          clientUuid: dto.clientUuid ?? null,
          createdBy: actor.user.id,
        }),
      );

      return order.id;
    });

    const created = await this.findById(id, { branchId: null, unrestricted: true }, locale);
    await this.notifyOpened(created, actor.user.id);

    await this.audit.record({
      userId: actor.user.id,
      action: AuditAction.MAINTENANCE_CREATED,
      entityType: AuditEntityType.MAINTENANCE_ORDER,
      entityId: created.id,
      after: { machineId: created.machineId, reportedFault: dto.reportedFault },
    });

    return created;
  }

  /**
   * Corrections. The fault text and the destination are editable while the machine is still away;
   * the cost is editable afterwards only when the close produced no money artefact, because an
   * expense, a violation and a one-off fee are all immutable once posted and a cost that no longer
   * matches the row it produced is worse than a cost that cannot be fixed here.
   */
  async update(
    id: string,
    dto: UpdateMaintenanceOrderDto,
    scope: BranchScope,
    actor: MaintenanceActor,
    locale: Locale,
  ): Promise<MaintenanceOrder> {
    const existing = await this.findById(id, scope, locale);

    if (existing.status === MaintenanceStatus.CANCELLED) {
      throw AppException.unprocessable(ErrorCode.INVALID_MAINTENANCE_STATUS, {
        status: existing.status,
      });
    }

    const isOpen = OPEN_MAINTENANCE_STATUSES.includes(existing.status);

    if (!isOpen && (dto.reportedFault !== undefined || dto.locationId !== undefined)) {
      throw AppException.unprocessable(ErrorCode.ORDER_ALREADY_CLOSED, { id });
    }

    if (dto.cost !== undefined && !isOpen && existing.financeTransactionId !== null) {
      throw AppException.unprocessable(ErrorCode.AUTO_TRANSACTION_IMMUTABLE, {
        id: existing.financeTransactionId,
      });
    }

    if (dto.cost !== undefined && !isOpen && existing.violationId !== null) {
      throw AppException.unprocessable(ErrorCode.AUTO_VIOLATION_IMMUTABLE, {
        id: existing.violationId,
      });
    }

    if (dto.cost !== undefined && !isOpen && existing.subscriptionId !== null) {
      throw AppException.unprocessable(ErrorCode.VALIDATION_FAILED, {
        id: existing.subscriptionId,
      });
    }

    await this.dataSource.transaction(async (manager) => {
      if (dto.locationId) await this.requireLocation(manager, dto.locationId);

      // Corrected upwards or downwards, the machine's running total has to follow the order it
      // came from — the cost summary and every decommission recommendation read that column.
      if (dto.cost !== undefined && existing.status === MaintenanceStatus.CLOSED) {
        await this.adjustMachineCost(
          manager,
          existing.machineId,
          dto.cost - Number(existing.cost ?? 0),
          actor.user.id,
        );
      }

      await manager.getRepository(MaintenanceOrder).update(id, {
        ...(dto.reportedFault !== undefined ? { reportedFault: dto.reportedFault } : {}),
        ...(dto.locationId !== undefined ? { maintenanceLocationId: dto.locationId } : {}),
        ...(dto.cost !== undefined ? { cost: String(dto.cost) } : {}),
        ...(dto.performedByName !== undefined ? { performedByName: dto.performedByName } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        updatedBy: actor.user.id,
      });
    });

    await this.audit.record({
      userId: actor.user.id,
      action: AuditAction.MAINTENANCE_UPDATED,
      entityType: AuditEntityType.MAINTENANCE_ORDER,
      entityId: id,
      before: {
        reportedFault: existing.reportedFault,
        maintenanceLocationId: existing.maintenanceLocationId,
        cost: existing.cost,
        performedByName: existing.performedByName,
      },
      after: {
        reportedFault: dto.reportedFault ?? existing.reportedFault,
        maintenanceLocationId: dto.locationId ?? existing.maintenanceLocationId,
        cost: dto.cost !== undefined ? String(dto.cost) : existing.cost,
        performedByName: dto.performedByName ?? existing.performedByName,
      },
    });

    return this.findById(id, scope, locale);
  }

  /**
   * The machine physically leaves. The hand-off is booked through the transfer engine rather than
   * by writing the machine's status here: the movement belongs in the timeline like every other
   * move, and the engine owns what a custody change means.
   */
  async send(
    id: string,
    dto: SendMaintenanceOrderDto,
    actor: MaintenanceActor,
    locale: Locale,
  ): Promise<MaintenanceOrder> {
    const order = await this.findById(id, { branchId: null, unrestricted: true }, locale);

    this.assertStatus(order, MaintenanceStatus.OPEN);

    const route = this.requireRoute(order);
    const machine = await this.requireMachine(order.machineId);
    const occurredAt = dto.occurredAt ?? new Date().toISOString();

    const transferId = await this.moveMachine({
      leg: 'out',
      route,
      order,
      machine,
      occurredAt,
      signature: dto.signature,
      warehouseId: dto.warehouseId,
      // It is broken — that is why the order exists. The technician's verdict is recorded on
      // close, not guessed at here.
      condition: ItemCondition.NOT_WORKING,
      actor,
    });

    // Conditional on the status this call was authorised against. The machine's own row is the
    // real serialization point — the transfer engine refuses a second dispatch of a unit that is
    // no longer in the warehouse — so a lost race here means somebody else already advanced it.
    const advanced = await this.orders.update(
      { id: order.id, status: MaintenanceStatus.OPEN },
      {
        status: MaintenanceStatus.IN_PROGRESS,
        outTransferId: transferId,
        updatedBy: actor.user.id,
      },
    );

    if (!advanced.affected) {
      throw AppException.conflict(ErrorCode.INVALID_MAINTENANCE_STATUS, { id: order.id });
    }

    await this.audit.record({
      userId: actor.user.id,
      action: AuditAction.MAINTENANCE_SENT,
      entityType: AuditEntityType.MAINTENANCE_ORDER,
      entityId: order.id,
      before: { status: MaintenanceStatus.OPEN },
      after: { status: MaintenanceStatus.IN_PROGRESS, outTransferId: transferId },
    });

    return this.findById(id, { branchId: null, unrestricted: true }, locale);
  }

  /** The same serial comes home. A different serial is a replacement instead (`12`, rule 5). */
  async receive(
    id: string,
    dto: ReceiveMaintenanceOrderDto,
    actor: MaintenanceActor,
    locale: Locale,
  ): Promise<MaintenanceOrder> {
    const order = await this.findById(id, { branchId: null, unrestricted: true }, locale);

    this.assertStatus(order, MaintenanceStatus.IN_PROGRESS);

    const route = this.requireRoute(order);
    const machine = await this.requireMachine(order.machineId);
    const occurredAt = dto.occurredAt ?? new Date().toISOString();

    const transferId = await this.moveMachine({
      leg: 'back',
      route,
      order,
      machine,
      occurredAt,
      signature: dto.signature,
      warehouseId: dto.warehouseId,
      // Whether the repair actually worked is the `result` on close; the storekeeper is only
      // signing that the unit is back on the shelf.
      condition: ItemCondition.GOOD,
      actor,
    });

    const advanced = await this.orders.update(
      { id: order.id, status: MaintenanceStatus.IN_PROGRESS },
      {
        status: MaintenanceStatus.RETURNED,
        inTransferId: transferId,
        returnedAt: new Date(occurredAt),
        updatedBy: actor.user.id,
      },
    );

    if (!advanced.affected) {
      throw AppException.conflict(ErrorCode.INVALID_MAINTENANCE_STATUS, { id: order.id });
    }

    const returned = await this.findById(id, { branchId: null, unrestricted: true }, locale);
    await this.notifyReturned(returned, actor.user.id);

    await this.audit.record({
      userId: actor.user.id,
      action: AuditAction.MAINTENANCE_RECEIVED,
      entityType: AuditEntityType.MAINTENANCE_ORDER,
      entityId: order.id,
      before: { status: MaintenanceStatus.IN_PROGRESS },
      after: { status: MaintenanceStatus.RETURNED, inTransferId: transferId },
    });

    return returned;
  }

  /**
   * The close flow (`11`, step 4), in one transaction.
   *
   * The order, the machine's running totals and whichever money artefact the responsible party
   * implies all commit together. Nothing here is retried on its own: a closed order with no
   * expense is a repair the company paid for and cannot find, and an expense with no closed order
   * is a payment nobody can explain.
   */
  async close(
    id: string,
    dto: CloseMaintenanceOrderDto,
    actor: MaintenanceActor,
    locale: Locale,
  ): Promise<CloseOutcome> {
    // Both are notified about after the commit, for the same reason the transfer engine defers
    // its own: a rolled-back close must not leave anybody holding a message about it.
    let chargedViolationId: string | null = null;
    let oldSerial: string | null = null;
    let costBefore = 0;

    const replacementMachineId = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, id);

      if (order.status === MaintenanceStatus.CLOSED) {
        throw AppException.conflict(ErrorCode.ORDER_ALREADY_CLOSED, { id });
      }

      this.assertStatus(order, MaintenanceStatus.RETURNED);

      if (!dto.isFreeUnderWarranty && dto.cost === undefined) {
        throw AppException.badRequest(ErrorCode.COST_REQUIRED, { id });
      }

      if (dto.result === MaintenanceResult.REPLACED && !dto.replacement) {
        throw AppException.badRequest(ErrorCode.REPLACEMENT_PAYLOAD_REQUIRED, { id });
      }

      // A free repair adds nothing to the bill but still counts as a repair (`11`, step 3).
      const cost = dto.isFreeUnderWarranty ? 0 : dto.cost!;
      costBefore = Number(order.cost ?? 0);

      if (dto.invoiceMediaId) {
        await this.media.claim([dto.invoiceMediaId], MediaPurpose.INVOICE, manager, actor.user.id);
      }

      const machine = await this.lockMachine(manager, order.machineId);

      await this.adjustMachineCost(manager, machine.id, cost, actor.user.id, { countRepair: true });

      const artefacts = await this.postClose(manager, order, machine, dto, cost, actor);

      chargedViolationId = artefacts.violationId;
      oldSerial = machine.serial;

      const swap = dto.replacement
        ? await this.replacements.perform(
            {
              oldMachine: machine,
              dto: dto.replacement,
              maintenanceOrderId: order.id,
              actorId: actor.user.id,
            },
            manager,
          )
        : null;

      await manager.getRepository(MaintenanceOrder).update(order.id, {
        status: MaintenanceStatus.CLOSED,
        result: dto.result,
        cost: String(cost),
        isFreeUnderWarranty: dto.isFreeUnderWarranty,
        responsibleParty: dto.responsibleParty,
        responsibleUserId: dto.responsibleUserId ?? null,
        responsibleMerchantId: dto.responsibleMerchantId ?? null,
        paymentMethodId: dto.paymentMethodId ?? null,
        supplierId: dto.supplierId ?? null,
        invoiceMediaId: dto.invoiceMediaId ?? null,
        performedByName: dto.performedByName ?? order.performedByName,
        returnedAt: new Date(dto.returnedAt),
        financeTransactionId: artefacts.financeTransactionId,
        violationId: artefacts.violationId,
        subscriptionId: artefacts.subscriptionId,
        closedByUserId: actor.user.id,
        closedAt: new Date(),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        updatedBy: actor.user.id,
      });

      return swap?.newMachineId ?? null;
    });

    const order = await this.findById(id, { branchId: null, unrestricted: true }, locale);

    await this.violations.notifyCreated(
      chargedViolationId ? [chargedViolationId] : [],
      actor.user.id,
    );
    await this.notifyClosed(order, dto.result, actor.user.id);

    if (replacementMachineId) {
      await this.notifyReplaced(replacementMachineId, oldSerial, order.branchId, actor.user.id);
    }

    await this.audit.record({
      userId: actor.user.id,
      action: AuditAction.MAINTENANCE_CLOSED,
      entityType: AuditEntityType.MAINTENANCE_ORDER,
      entityId: id,
      before: { status: MaintenanceStatus.RETURNED, cost: costBefore },
      after: {
        status: MaintenanceStatus.CLOSED,
        cost: Number(order.cost ?? 0),
        result: dto.result,
      },
    });

    return { order, replacementMachineId };
  }

  /** The fault turned out to be nothing, or the machine never went. Cancelled, with a reason. */
  async cancel(
    id: string,
    dto: CancelMaintenanceOrderDto,
    actor: MaintenanceActor,
    locale: Locale,
  ): Promise<MaintenanceOrder> {
    let statusBefore: MaintenanceStatus = MaintenanceStatus.OPEN;

    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, id);
      statusBefore = order.status;

      if (order.status === MaintenanceStatus.CLOSED) {
        throw AppException.conflict(ErrorCode.ORDER_ALREADY_CLOSED, { id });
      }

      if (order.status === MaintenanceStatus.CANCELLED) {
        throw AppException.conflict(ErrorCode.INVALID_MAINTENANCE_STATUS, { status: order.status });
      }

      // The machine is out at the workshop or the factory: cancelling the paperwork would leave
      // it in a status nothing owns. It has to be booked back in first.
      if (order.status !== MaintenanceStatus.OPEN && order.inTransferId === null) {
        throw AppException.unprocessable(ErrorCode.INVALID_MAINTENANCE_STATUS, {
          status: order.status,
        });
      }

      await manager.getRepository(MaintenanceOrder).update(order.id, {
        status: MaintenanceStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.reason,
        updatedBy: actor.user.id,
      });
    });

    await this.audit.record({
      userId: actor.user.id,
      action: AuditAction.MAINTENANCE_CANCELLED,
      entityType: AuditEntityType.MAINTENANCE_ORDER,
      entityId: id,
      before: { status: statusBefore },
      after: { status: MaintenanceStatus.CANCELLED, reason: dto.reason },
    });

    return this.findById(id, { branchId: null, unrestricted: true }, locale);
  }

  /**
   * The standalone factory swap (`12`): the unit went out and a different serial came back, so
   * there is nothing to `receive`. Closes the open order as `REPLACED` on the way through, which
   * is step 7 of the replace flow.
   */
  async replaceMachine(
    machineId: string,
    dto: ReplacementMachineDto,
    actor: MaintenanceActor,
  ): Promise<{ newMachineId: string; maintenanceOrderId: string | null }> {
    let oldSerial = '';
    let branchId: string | null = null;

    const outcome = await this.dataSource.transaction(async (manager) => {
      const machine = await this.lockMachine(manager, machineId);
      const order = await this.openOrderFor(manager, machine.id, /* lock */ true);

      oldSerial = machine.serial;
      branchId = machine.currentBranchId;

      const swap = await this.replacements.perform(
        {
          oldMachine: machine,
          dto,
          maintenanceOrderId: order?.id ?? null,
          actorId: actor.user.id,
        },
        manager,
      );

      if (order) {
        // Nobody paid: the factory made the swap good. `FACTORY` is what that is called on an
        // order, and it is the one responsible party that posts no money anywhere.
        await this.adjustMachineCost(manager, machine.id, 0, actor.user.id, { countRepair: true });

        await manager.getRepository(MaintenanceOrder).update(order.id, {
          status: MaintenanceStatus.CLOSED,
          result: MaintenanceResult.REPLACED,
          cost: '0',
          isFreeUnderWarranty: false,
          responsibleParty: ResponsibleParty.FACTORY,
          returnedAt: new Date(dto.replacedAt),
          closedByUserId: actor.user.id,
          closedAt: new Date(),
          updatedBy: actor.user.id,
        });
      }

      return { newMachineId: swap.newMachineId, maintenanceOrderId: order?.id ?? null };
    });

    await this.notifyReplaced(outcome.newMachineId, oldSerial, branchId, actor.user.id);

    return outcome;
  }

  /** Every order this machine has ever had, with the totals a Director reads first (`11`). */
  async historyOf(
    machineId: string,
    locale: Locale,
    query: QueryMachineMaintenanceHistoryDto,
  ): Promise<{
    orders: MaintenanceOrder[];
    totals: MaintenanceTotals;
    ordersMeta: PaginatedResult<MaintenanceOrder>['meta'];
  }> {
    const filtered = this.baseQuery(locale).andWhere('order.machine_id = :machineId', {
      machineId,
    });

    const all = await filtered.clone().getMany();
    const [orders, total] = await filtered
      .clone()
      .orderBy('order.sentAt', 'DESC')
      .addOrderBy('order.id', 'ASC')
      .skip(query.skip)
      .take(query.take)
      .getManyAndCount();

    return {
      orders,
      totals: totalsOf(all),
      ordersMeta: new PaginatedResult(orders, total, query.page, query.limit).meta,
    };
  }

  /** Used by decommission (`13`, step 2) to refuse scrapping a machine that is still in a shop. */
  async openOrderFor(
    manager: EntityManager,
    machineId: string,
    lock = false,
  ): Promise<MaintenanceOrder | null> {
    const qb = manager
      .getRepository(MaintenanceOrder)
      .createQueryBuilder('order')
      .where('order.machine_id = :machineId', { machineId })
      .andWhere('order.status IN (:...open)', { open: OPEN_MAINTENANCE_STATUSES });

    if (lock) qb.setLock('pessimistic_write');

    return qb.getOne();
  }

  // ── notifications ──────────────────────────────────────────────────────────

  /** `18`: a machine leaving the branch for repair is the Director's and the supervisor's news. */
  private async notifyOpened(order: MaintenanceOrder, actorId: string): Promise<void> {
    await this.notifications.tryDispatch({
      templateCode: NotificationTemplateCode.MAINTENANCE_OPENED,
      recipients: await this.recipients.directorsAndBranchSupervisors(order.branchId),
      params: {
        referenceNo: order.referenceNo,
        machineSerial: order.machine?.serial ?? '—',
        locationName: order.maintenanceLocation?.translations?.[0]?.name ?? '—',
      },
      entityType: NotificationEntityType.MAINTENANCE_ORDER,
      entityId: order.id,
      actorId,
    });
  }

  private async notifyReturned(order: MaintenanceOrder, actorId: string): Promise<void> {
    await this.notifications.tryDispatch({
      templateCode: NotificationTemplateCode.MAINTENANCE_RETURNED,
      recipients: await this.recipients.directorsAndBranchSupervisors(order.branchId),
      params: {
        referenceNo: order.referenceNo,
        machineSerial: order.machine?.serial ?? '—',
      },
      entityType: NotificationEntityType.MAINTENANCE_ORDER,
      entityId: order.id,
      actorId,
    });
  }

  /**
   * `13`, step 7 and the "notify the Director" line `11` leaves to this phase.
   *
   * Only `UNREPAIRABLE` produces anything. A repair that worked needs no decision from anybody,
   * and a swap is announced by `notifyReplaced` instead — this is the branch where the machine is
   * still on the books and somebody now has to decide what to do with it.
   */
  private async notifyClosed(
    order: MaintenanceOrder,
    result: MaintenanceResult,
    actorId: string,
  ): Promise<void> {
    if (result !== MaintenanceResult.UNREPAIRABLE) return;

    const machine = order.machine;
    const repairCost = Number(machine?.totalRepairCost ?? 0);
    const purchasePrice = Number(machine?.purchasePrice ?? 0);

    await this.notifications.tryDispatch({
      templateCode: NotificationTemplateCode.DECOMMISSION_CANDIDATE,
      recipients: await this.recipients.directors(),
      params: {
        machineSerial: machine?.serial ?? '—',
        repairCost: repairCost.toFixed(2),
        purchasePrice: purchasePrice > 0 ? purchasePrice.toFixed(2) : '—',
        ratio: purchasePrice > 0 ? ((repairCost / purchasePrice) * 100).toFixed(1) : '—',
      },
      entityType: NotificationEntityType.MACHINE,
      entityId: order.machineId,
      actorId,
    });
  }

  /** `12`, step 7: the serial on the books changed, which the Director has to know about. */
  private async notifyReplaced(
    newMachineId: string,
    oldSerial: string | null,
    branchId: string | null,
    actorId: string,
  ): Promise<void> {
    const replacement = await this.dataSource
      .getRepository(Machine)
      .findOne({ where: { id: newMachineId } });

    await this.notifications.tryDispatch({
      templateCode: NotificationTemplateCode.MACHINE_REPLACED,
      recipients: await this.recipients.directorsAndBranchSupervisors(branchId),
      params: { oldSerial: oldSerial ?? '—', newSerial: replacement?.serial ?? '—' },
      entityType: NotificationEntityType.MACHINE,
      entityId: newMachineId,
      actorId,
    });
  }

  // ── close-flow branches ────────────────────────────────────────────────────

  /**
   * The automatic posting rule the business asked for (`11`, step 4). Exactly one of these
   * branches produces a record, and which one is decided by who is paying rather than by anything
   * the client sends.
   */
  private async postClose(
    manager: EntityManager,
    order: MaintenanceOrder,
    machine: Machine,
    dto: CloseMaintenanceOrderDto,
    cost: number,
    actor: MaintenanceActor,
  ): Promise<{
    financeTransactionId: string | null;
    violationId: string | null;
    subscriptionId: string | null;
  }> {
    const nothing = { financeTransactionId: null, violationId: null, subscriptionId: null };

    // Under warranty the factory eats it, and a zero-value expense in the ledger is noise the
    // accountant has to explain away every month.
    if (dto.isFreeUnderWarranty || cost <= 0) return nothing;

    if (dto.responsibleParty === ResponsibleParty.FACTORY) return nothing;

    if (dto.responsibleParty === ResponsibleParty.COMPANY) {
      const posted = await this.posting.post(
        {
          kind: FinanceKind.EXPENSE,
          amount: cost,
          categoryCode: SystemCategoryCode.MAINTENANCE,
          transactionDate: new Date(dto.returnedAt),
          paymentMethodId: dto.paymentMethodId!,
          branchId: machine.currentBranchId,
          source: TransactionSource.AUTO_MAINTENANCE,
          sourceRefType: FinanceSourceRefType.MAINTENANCE_ORDER,
          // The order's own id. A repair happens once, so this is the identity that makes a
          // replayed close a no-op instead of a second expense.
          sourceRefId: order.id,
          supplierId: dto.supplierId ?? null,
          invoiceMediaId: dto.invoiceMediaId ?? null,
          notes: order.reportedFault,
          actorId: actor.user.id,
        },
        manager,
      );

      return { ...nothing, financeTransactionId: posted.id };
    }

    if (dto.responsibleParty === ResponsibleParty.REPRESENTATIVE) {
      const violation = await this.violations.createFromMaintenance(
        {
          userId: dto.responsibleUserId!,
          machineId: machine.id,
          branchId: order.branchId,
          amount: cost,
          severity: severityFor(cost),
          description: `${order.referenceNo}: ${order.reportedFault}`,
          actorId: actor.user.id,
        },
        manager,
      );

      return { ...nothing, violationId: violation.id };
    }

    const fee = await this.merchants.createOneTimeFee(
      {
        merchantId: dto.responsibleMerchantId!,
        machineId: machine.id,
        amount: cost,
        chargedOn: dto.returnedAt.slice(0, 10),
        notes: `${order.referenceNo}: ${order.reportedFault}`,
        actorId: actor.user.id,
      },
      manager,
    );

    return { ...nothing, subscriptionId: fee.id };
  }

  // ── transfers ──────────────────────────────────────────────────────────────

  /**
   * Books one leg of the journey through the transfer engine and returns its id.
   *
   * The engine runs its own transaction, so this is deliberately called *before* the order row is
   * advanced rather than from inside a transaction of ours: a lock held on the machine here would
   * be a lock the engine then waits for on another connection, and the request would hang. The
   * machine's status is what serializes two concurrent sends — the second one finds a unit that is
   * no longer where the rule says it has to be.
   */
  private async moveMachine(leg: MachineMove): Promise<string> {
    const type = leg.leg === 'out' ? leg.route.out : leg.route.back;
    const warehouseId = await this.resolveWarehouse(leg);

    const dto: CreateTransferDto = {
      // Derived from the order and the leg, so a retried send resolves to the transfer it already
      // created instead of a second one.
      clientUuid: deterministicUuid(leg.order.id, `maintenance:${leg.leg}`),
      type,
      toPartyId: warehouseId ?? undefined,
      occurredAt: leg.occurredAt,
      items: [
        // The charger and the carton travel with the unit: a workshop diagnosing a charging
        // fault needs both, and what comes back is checked against this on the return leg.
        {
          machineId: leg.machine.id,
          hasCharger: true,
          hasBox: leg.machine.hasBox,
          condition: leg.condition,
        },
      ],
      notes: leg.order.referenceNo,
      senderSignature: leg.signature,
    };

    const transfer = await this.transfers.create(dto, leg.actor);

    // The company is on both sides of a maintenance leg: the storekeeper who signs it out is the
    // same office that signs it back in, so the one signature closes the document.
    if (transfer.status === TransferStatus.PENDING) {
      await this.transfers.confirm(
        transfer.id,
        {
          signature: leg.signature,
          payloadHash: await this.transfers.currentPayloadHash(transfer.id),
        },
        leg.actor,
      );
    }

    return transfer.id;
  }

  /**
   * The store on the receiving end. Only two of the six legs have one: the internal workshop, and
   * the company warehouse a repaired unit comes home to. The factory and a service centre are
   * parties without a row to point at.
   */
  private async resolveWarehouse(leg: MachineMove): Promise<string | null> {
    const type = leg.leg === 'out' ? leg.route.warehouseType : WarehouseType.COMPANY_MAIN;

    if (!type) return null;
    if (leg.warehouseId) return leg.warehouseId;

    const candidates = await this.dataSource
      .getRepository(Warehouse)
      .find({ where: { type, isActive: true } });

    if (candidates.length === 1) return candidates[0].id;

    // Two workshops and no instruction is not something to guess at: the machine would be booked
    // into the wrong building and the storekeeper there would have no idea why.
    throw new AppException(ErrorCode.VALIDATION_FAILED, {
      details: [
        {
          field: 'warehouseId',
          value: leg.warehouseId,
          constraint:
            candidates.length === 0
              ? `no active ${type} warehouse exists`
              : `required: ${candidates.length} active ${type} warehouses exist`,
        },
      ],
    });
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private baseQuery(locale: Locale): SelectQueryBuilder<MaintenanceOrder> {
    const qb = this.orders
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.machine', 'machine')
      .leftJoinAndSelect('machine.machineModel', 'model')
      .leftJoinAndSelect('order.maintenanceLocation', 'location')
      .leftJoinAndSelect('order.branch', 'branch');

    joinTranslation(qb, 'model', 'translations', locale);
    joinTranslation(qb, 'location', 'translations', locale);

    return qb;
  }

  private async lockOrder(manager: EntityManager, id: string): Promise<MaintenanceOrder> {
    const order = await manager
      .getRepository(MaintenanceOrder)
      .createQueryBuilder('order')
      .where('order.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();

    if (!order) throw AppException.notFound(ErrorCode.MAINTENANCE_ORDER_NOT_FOUND, { id });

    return order;
  }

  /** `SELECT … FOR UPDATE`, the same guard the transfer engine takes before it moves custody. */
  private async lockMachine(manager: EntityManager, id: string): Promise<Machine> {
    const machine = await manager
      .getRepository(Machine)
      .createQueryBuilder('machine')
      .where('machine.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();

    if (!machine) throw AppException.notFound(ErrorCode.MACHINE_NOT_FOUND, { id });

    return machine;
  }

  private async requireMachine(id: string): Promise<Machine> {
    const machine = await this.dataSource.getRepository(Machine).findOne({ where: { id } });

    if (!machine) throw AppException.notFound(ErrorCode.MACHINE_NOT_FOUND, { id });

    return machine;
  }

  private async requireLocation(manager: EntityManager, id: string): Promise<MaintenanceLocation> {
    const location = await manager
      .getRepository(MaintenanceLocation)
      .findOne({ where: { id, isActive: true } });

    if (!location) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'locationId', value: id, constraint: 'unknown maintenance location' }],
      });
    }

    return location;
  }

  /**
   * Which pair of transfers this destination implies. A location added later with a code the
   * transfer graph has never heard of has no route, and inventing one would move a machine to a
   * status nothing can bring it back from.
   */
  private requireRoute(order: MaintenanceOrder): MaintenanceRoute {
    const route = routeFor(order.maintenanceLocation?.code ?? '');

    if (!route) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          {
            field: 'locationId',
            value: order.maintenanceLocation?.code,
            constraint:
              'has no transfer route: expected INTERNAL_WORKSHOP, FACTORY or SERVICE_CENTER',
          },
        ],
      });
    }

    return route;
  }

  private assertStatus(order: MaintenanceOrder, expected: MaintenanceStatus): void {
    if (order.status !== expected) {
      throw AppException.unprocessable(ErrorCode.INVALID_MAINTENANCE_STATUS, {
        status: order.status,
        expected,
      });
    }
  }

  /** `11`, rule 4. A replaced or scrapped machine is history — there is nothing left to repair. */
  private assertMaintainable(machine: Machine): void {
    if (machine.status === MachineStatus.REPLACED) {
      throw AppException.conflict(ErrorCode.MACHINE_ALREADY_REPLACED, { serial: machine.serial });
    }

    if (TERMINAL_MACHINE_STATUSES.includes(machine.status)) {
      throw AppException.unprocessable(ErrorCode.MACHINE_RETIRED, { serial: machine.serial });
    }

    // The order is opened while the unit sits in the company warehouse (`11`, lifecycle): the
    // dispatch leg starts there, and an order opened for a machine still in a shop would be
    // stuck at OPEN until somebody brought it back anyway.
    if (machine.status !== MachineStatus.IN_COMPANY_WAREHOUSE) {
      throw AppException.unprocessable(ErrorCode.INVALID_MACHINE_STATUS, {
        serial: machine.serial,
        status: machine.status,
        expected: MachineStatus.IN_COMPANY_WAREHOUSE,
      });
    }
  }

  /** `11`, rule 1, checked under the machine's row lock. */
  private async assertNoOpenOrder(manager: EntityManager, machineId: string): Promise<void> {
    const open = await manager.getRepository(MaintenanceOrder).findOne({
      where: { machineId, status: In(OPEN_MAINTENANCE_STATUSES) },
    });

    if (open) {
      throw AppException.conflict(ErrorCode.MACHINE_ALREADY_IN_MAINTENANCE, {
        id: open.id,
        reference: open.referenceNo,
      });
    }
  }

  /**
   * The machine aggregate (`11`, step 3). Added by Postgres against the numeric column rather
   * than read into a JS float and written back, which would round the running total on every
   * repair — and this is the number a decommission decision is taken on.
   */
  private async adjustMachineCost(
    manager: EntityManager,
    machineId: string,
    delta: number,
    actorId: string,
    options: { countRepair?: boolean } = {},
  ): Promise<void> {
    await manager
      .getRepository(Machine)
      .createQueryBuilder()
      .update(Machine)
      .set({
        totalRepairCost: () => 'total_repair_cost + :delta',
        ...(options.countRepair ? { repairCount: () => 'repair_count + 1' } : {}),
        updatedBy: actorId,
      })
      .where('id = :machineId', { machineId })
      .setParameters({ delta, machineId })
      .execute();
  }
}

interface MachineMove {
  leg: 'out' | 'back';
  route: MaintenanceRoute;
  order: MaintenanceOrder;
  machine: Machine;
  occurredAt: string;
  signature: SignatureDto;
  warehouseId?: string;
  condition: ItemCondition;
  actor: MaintenanceActor;
}

/**
 * How hard the disciplinary record reads. Tied to the size of the bill because that is the only
 * measure of damage a maintenance order actually carries — the technician's notes are prose.
 */
export function severityFor(cost: number): Severity {
  if (cost >= HIGH_SEVERITY_COST) return Severity.HIGH;
  if (cost >= MEDIUM_SEVERITY_COST) return Severity.MEDIUM;

  return Severity.LOW;
}

const MEDIUM_SEVERITY_COST = 200;
const HIGH_SEVERITY_COST = 1000;

export function totalsOf(orders: MaintenanceOrder[]): MaintenanceTotals {
  const closed = orders.filter((order) => order.status === MaintenanceStatus.CLOSED);

  const sumWhere = (party: ResponsibleParty): number =>
    closed
      .filter((order) => order.responsibleParty === party && !order.isFreeUnderWarranty)
      .reduce((sum, order) => sum + Number(order.cost ?? 0), 0);

  return {
    orders: orders.length,
    totalCost: closed.reduce((sum, order) => sum + Number(order.cost ?? 0), 0),
    freeUnderWarranty: closed.filter((order) => order.isFreeUnderWarranty).length,
    chargedToCompany: sumWhere(ResponsibleParty.COMPANY),
    chargedToRepresentative: sumWhere(ResponsibleParty.REPRESENTATIVE),
    chargedToMerchant: sumWhere(ResponsibleParty.MERCHANT),
    chargedToFactory: sumWhere(ResponsibleParty.FACTORY),
  };
}
