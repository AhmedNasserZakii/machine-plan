import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { Locale } from 'src/common/constants/locales';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import {
  NotificationEntityType,
  NotificationTemplateCode,
} from 'src/common/enums/notification.enum';
import { MediaPurpose, WarehouseType } from 'src/common/enums/operations.enum';
import {
  ItemCondition,
  PartyType,
  TransferStatus,
  TransferType,
} from 'src/common/enums/transfer.enum';
import { AppException } from 'src/common/errors';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import { deterministicUuid, joinTranslation } from 'src/common/utils';
import { DecommissionReason } from 'src/modules/lookups/entities/decommission-reason.entity';
import { MachineInsightsService } from 'src/modules/machines/machine-insights.service';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { MaintenanceService } from 'src/modules/maintenance/maintenance.service';
import { MediaService } from 'src/modules/media/media.service';
import { NotificationDispatcherService } from 'src/modules/notifications/services/notification-dispatcher.service';
import { NotificationRecipientsService } from 'src/modules/notifications/services/notification-recipients.service';
import { Warehouse } from 'src/modules/organization/entities/warehouse.entity';
import { Transfer } from 'src/modules/transfers/entities/transfer.entity';
import { TransferItem } from 'src/modules/transfers/entities/transfer-item.entity';
import { TransfersService } from 'src/modules/transfers/transfers.service';
import {
  DecommissionMachineDto,
  QueryDecommissionsDto,
  RevertDecommissionDto,
} from './dto/decommission.dto';
import { Decommission } from './entities/decommission.entity';

export interface DecommissionActor {
  user: AuthUser;
  ipAddress: string | null;
}

/**
 * End of life (`13`). The system recommends — through the candidates list — and never acts: every
 * row in this table was written because a Director decided, which is why `notes` is mandatory and
 * why the economics are frozen into the row rather than joined at read time.
 */
@Injectable()
export class DecommissionsService {
  constructor(
    @InjectRepository(Decommission) private readonly decommissions: Repository<Decommission>,
    private readonly transfers: TransfersService,
    private readonly maintenance: MaintenanceService,
    private readonly insights: MachineInsightsService,
    private readonly media: MediaService,
    private readonly notifications: NotificationDispatcherService,
    private readonly recipients: NotificationRecipientsService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    query: QueryDecommissionsDto,
    scope: BranchScope,
    locale: Locale,
  ): Promise<PaginatedResult<Decommission>> {
    const qb = this.baseQuery(locale);

    // A scrapped machine keeps the branch it last belonged to, which is the branch that has to
    // answer for it having been scrapped.
    if (!scope.unrestricted) {
      qb.andWhere('machine.current_branch_id = :scopeBranch', { scopeBranch: scope.branchId });
    } else if (query.branchId) {
      qb.andWhere('machine.current_branch_id = :branchId', { branchId: query.branchId });
    }

    if (query.reasonId) {
      qb.andWhere('decommission.decommission_reason_id = :reasonId', { reasonId: query.reasonId });
    }
    if (query.dateFrom) {
      qb.andWhere('decommission.decommissioned_at >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('decommission.decommissioned_at <= :dateTo', { dateTo: query.dateTo });
    }

    qb.orderBy(`decommission.${query.sortBy}`, query.order).addOrderBy('decommission.id', 'ASC');
    qb.skip(query.skip).take(query.take);

    const [rows, total] = await qb.getManyAndCount();

    return new PaginatedResult(rows, total, query.page, query.limit);
  }

  /** The live record for a machine, reverted ones included — history is not hidden. */
  async findByMachine(machineId: string, locale: Locale): Promise<Decommission> {
    const row = await this.baseQuery(locale)
      .andWhere('decommission.machine_id = :machineId', { machineId })
      .orderBy('decommission.decommissioned_at', 'DESC')
      .getOne();

    if (!row) throw AppException.notFound(ErrorCode.DECOMMISSION_NOT_FOUND, { id: machineId });

    return row;
  }

  /**
   * Scraps the machine (`13`).
   *
   * The `COMPANY_TO_SCRAP` hand-off is booked first and on its own transaction — the engine locks
   * the machine, and holding that lock here while waiting for it on another connection would hang
   * the request. It is also what serializes two Directors scrapping the same unit: the second
   * finds a machine that is no longer in the company warehouse. Everything this module owns then
   * commits together.
   */
  async decommission(
    machineId: string,
    dto: DecommissionMachineDto,
    actor: DecommissionActor,
    locale: Locale,
  ): Promise<Decommission> {
    const machine = await this.requireMachine(machineId);

    await this.assertScrappable(machine);

    const snapshot = await this.insights.chainSnapshot(machine.id);

    // A machine already sitting in DECOMMISSIONED with no live row is a scrap transfer whose
    // record did not land. Finishing the record is the only way forward, so the hand-off is not
    // booked twice.
    const transferId =
      machine.status === MachineStatus.DECOMMISSIONED
        ? await this.lastScrapTransferId(machine.id)
        : await this.bookScrapTransfer(machine, dto, actor);

    const id = await this.dataSource.transaction(async (manager) => {
      if (dto.signature?.signatureMediaId) {
        await this.media.claim(
          [dto.signature.signatureMediaId],
          MediaPurpose.SIGNATURE,
          manager,
          actor.user.id,
        );
      }

      const repo = manager.getRepository(Decommission);
      const row = await repo.save(
        repo.create({
          machineId: machine.id,
          decommissionReasonId: await this.requireReasonId(dto.reasonId),
          notes: dto.notes,
          decommissionedAt: new Date(dto.decommissionedAt),
          decommissionedByUserId: actor.user.id,
          purchasePriceAtDecision:
            snapshot.purchasePrice === null ? null : String(snapshot.purchasePrice),
          cumulativeRepairCostAtDecision: String(snapshot.cumulativeRepairCost),
          repairCountAtDecision: snapshot.cumulativeRepairCount,
          chainLengthAtDecision: snapshot.chainLength,
          transferId,
          signatureMediaId: dto.signature?.signatureMediaId ?? null,
          createdBy: actor.user.id,
        }),
      );

      // The transfer stamped `decommissioned_at` with the moment it was confirmed; the date the
      // Director signed off on is the one that belongs on the asset.
      await manager.getRepository(Machine).update(machine.id, {
        decommissionedAt: new Date(dto.decommissionedAt),
        updatedBy: actor.user.id,
      });

      return row.id;
    });

    const row = await this.findById(id, locale);

    // `13`, step 7. The Director may well be the person who just signed it off, in which case the
    // dispatcher's no-self-notification rule drops it and the other Directors still hear.
    await this.notifications.tryDispatch({
      templateCode: NotificationTemplateCode.MACHINE_DECOMMISSIONED,
      recipients: await this.recipients.directorsAndBranchSupervisors(machine.currentBranchId),
      params: {
        machineSerial: machine.serial,
        reason: row.reason?.translations?.[0]?.name ?? '—',
        repairCost: Number(row.cumulativeRepairCostAtDecision ?? 0).toFixed(2),
      },
      entityType: NotificationEntityType.MACHINE,
      entityId: machine.id,
      actorId: actor.user.id,
    });

    await this.audit.record({
      userId: actor.user.id,
      action: AuditAction.MACHINE_DECOMMISSIONED,
      entityType: AuditEntityType.DECOMMISSION,
      entityId: row.id,
      after: { machineId: machine.id, reasonId: row.decommissionReasonId, notes: dto.notes },
    });

    return row;
  }

  /**
   * The mistake path (`13`, rule 3), guarded by `settings.manage` rather than by
   * `machines.decommission`: undoing an end-of-life decision is an administrative act, not part of
   * the operation that took it.
   *
   * The machine comes back to the company warehouse rather than to wherever it was before. It has
   * physically been to the scrapyard, and pretending otherwise would put it back in a shop.
   */
  async revert(
    machineId: string,
    dto: RevertDecommissionDto,
    actor: DecommissionActor,
    locale: Locale,
  ): Promise<Decommission> {
    const id = await this.dataSource.transaction(async (manager) => {
      const live = await manager.getRepository(Decommission).findOne({
        where: { machineId, revertedAt: IsNull() },
      });

      if (!live) throw AppException.notFound(ErrorCode.DECOMMISSION_NOT_FOUND, { id: machineId });

      const warehouse = await manager
        .getRepository(Warehouse)
        .findOne({ where: { type: WarehouseType.COMPANY_MAIN, isActive: true } });

      if (!warehouse) {
        throw AppException.unprocessable(ErrorCode.WAREHOUSE_TYPE_CONFLICT, {
          expected: WarehouseType.COMPANY_MAIN,
        });
      }

      await manager.getRepository(Decommission).update(live.id, {
        revertedAt: new Date(),
        revertedByUserId: actor.user.id,
        revertReason: dto.reason,
        updatedBy: actor.user.id,
      });

      await manager.getRepository(Machine).update(machineId, {
        status: MachineStatus.IN_COMPANY_WAREHOUSE,
        currentHolderType: PartyType.WAREHOUSE,
        currentHolderId: warehouse.id,
        currentWarehouseId: warehouse.id,
        currentBranchId: warehouse.branchId,
        decommissionedAt: null,
        updatedBy: actor.user.id,
      });

      return live.id;
    });

    await this.audit.record({
      userId: actor.user.id,
      action: AuditAction.DECOMMISSION_REVERTED,
      entityType: AuditEntityType.DECOMMISSION,
      entityId: id,
      before: { revertedAt: null },
      after: { revertedAt: new Date().toISOString(), reason: dto.reason },
    });

    return this.findById(id, locale);
  }

  async findById(id: string, locale: Locale): Promise<Decommission> {
    const row = await this.baseQuery(locale).andWhere('decommission.id = :id', { id }).getOne();

    if (!row) throw AppException.notFound(ErrorCode.DECOMMISSION_NOT_FOUND, { id });

    return row;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private baseQuery(locale: Locale): SelectQueryBuilder<Decommission> {
    const qb = this.decommissions
      .createQueryBuilder('decommission')
      .innerJoinAndSelect('decommission.machine', 'machine')
      .innerJoinAndSelect('decommission.reason', 'reason');

    joinTranslation(qb, 'reason', 'translations', locale);

    return qb;
  }

  private async requireMachine(id: string): Promise<Machine> {
    const machine = await this.dataSource.getRepository(Machine).findOne({ where: { id } });

    if (!machine) throw AppException.notFound(ErrorCode.MACHINE_NOT_FOUND, { id });

    return machine;
  }

  private async requireReasonId(id: string): Promise<string> {
    const reason = await this.dataSource
      .getRepository(DecommissionReason)
      .findOne({ where: { id, isActive: true } });

    if (!reason) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'reasonId', value: id, constraint: 'unknown decommission reason' }],
      });
    }

    return reason.id;
  }

  /** Steps 1 to 3 of the flow, in the order the spec puts them. */
  private async assertScrappable(machine: Machine): Promise<void> {
    const live = await this.decommissions.findOne({
      where: { machineId: machine.id, revertedAt: IsNull() },
    });

    if (live) {
      throw AppException.conflict(ErrorCode.ALREADY_DECOMMISSIONED, { serial: machine.serial });
    }

    if (machine.status === MachineStatus.REPLACED) {
      throw AppException.conflict(ErrorCode.MACHINE_ALREADY_REPLACED, { serial: machine.serial });
    }

    // You cannot scrap something that is still with a merchant: it has to come back first.
    if (
      machine.status !== MachineStatus.IN_COMPANY_WAREHOUSE &&
      machine.status !== MachineStatus.DECOMMISSIONED
    ) {
      throw AppException.unprocessable(ErrorCode.MACHINE_NOT_IN_WAREHOUSE, {
        serial: machine.serial,
        status: machine.status,
      });
    }

    const open = await this.maintenance.openOrderFor(this.dataSource.manager, machine.id);

    if (open) {
      throw AppException.conflict(ErrorCode.OPEN_MAINTENANCE_ORDER, {
        id: open.id,
        reference: open.referenceNo,
      });
    }
  }

  /**
   * The scrap store hand-off. Auto-confirmed by the rules map, so this one call both records the
   * movement and moves the machine into `DECOMMISSIONED`.
   */
  private async bookScrapTransfer(
    machine: Machine,
    dto: DecommissionMachineDto,
    actor: DecommissionActor,
  ): Promise<string> {
    const warehouse = await this.dataSource
      .getRepository(Warehouse)
      .findOne({ where: { type: WarehouseType.SCRAP, isActive: true } });

    if (!warehouse) {
      throw AppException.unprocessable(ErrorCode.WAREHOUSE_TYPE_CONFLICT, {
        expected: WarehouseType.SCRAP,
      });
    }

    // The scrap leg is signed by the sender (`09`'s rules map): nobody at the scrapyard has an
    // account, so the Director's own signature is what closes the document.
    if (!dto.signature) throw AppException.unprocessable(ErrorCode.SIGNATURE_REQUIRED);

    const transfer = await this.transfers.create(
      {
        // Derived from the machine, so a retried request resolves to the hand-off it already
        // booked instead of a second trip to the scrapyard.
        clientUuid: deterministicUuid(machine.id, `decommission:${dto.decommissionedAt}`),
        type: TransferType.COMPANY_TO_SCRAP,
        toPartyId: warehouse.id,
        occurredAt: dto.decommissionedAt,
        items: [
          {
            machineId: machine.id,
            hasCharger: false,
            hasBox: machine.hasBox,
            // It is being thrown away. Recording it as GOOD would put a working unit in the
            // scrap store as far as every report is concerned.
            condition: ItemCondition.NOT_WORKING,
          },
        ],
        notes: dto.notes,
        senderSignature: dto.signature,
      },
      actor,
    );

    return transfer.id;
  }

  /** The scrap hand-off already booked for a machine whose record did not land. */
  private async lastScrapTransferId(machineId: string): Promise<string | null> {
    const item = await this.dataSource
      .getRepository(TransferItem)
      .createQueryBuilder('item')
      .innerJoin(Transfer, 'transfer', 'transfer.id = item.transfer_id')
      .where('item.machine_id = :machineId', { machineId })
      .andWhere('transfer.type = :type', { type: TransferType.COMPANY_TO_SCRAP })
      .andWhere('transfer.status = :confirmed', { confirmed: TransferStatus.CONFIRMED })
      .orderBy('transfer.occurred_at', 'DESC')
      .getOne();

    return item?.transferId ?? null;
  }
}
