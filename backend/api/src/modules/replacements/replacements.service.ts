import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { WarehouseType } from 'src/common/enums/operations.enum';
import { PartyType } from 'src/common/enums/transfer.enum';
import { AppException } from 'src/common/errors';
import { BranchScope } from 'src/common/types/request.types';
import { MachineModel } from 'src/modules/lookups/entities/machine-model.entity';
import { Battery } from 'src/modules/machines/entities/battery.entity';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { Warehouse } from 'src/modules/organization/entities/warehouse.entity';
import { QueryReplacementsDto, ReplacementMachineDto } from './dto/replacement.dto';
import { MachineReplacement } from './entities/machine-replacement.entity';

/** The statuses a machine may be swapped out of (`12`, step 1). */
const REPLACEABLE_STATUSES: readonly MachineStatus[] = [
  MachineStatus.AT_FACTORY,
  MachineStatus.IN_COMPANY_WAREHOUSE,
];

export interface ReplacementContext {
  /** Already locked `FOR UPDATE` by the caller — the whole flow runs inside its transaction. */
  oldMachine: Machine;
  dto: ReplacementMachineDto;
  maintenanceOrderId: string | null;
  actorId: string;
}

export interface ReplacementOutcome {
  replacementId: string;
  newMachineId: string;
}

/**
 * The factory swap (`12`).
 *
 * `perform` takes the caller's `EntityManager` because a replacement is never a fact on its own:
 * it concludes a maintenance order, and a new serial that committed without the order closing —
 * or an order closed as `REPLACED` with no replacement row — is a machine nobody can account for.
 */
@Injectable()
export class ReplacementsService {
  constructor(
    @InjectRepository(MachineReplacement)
    private readonly replacements: Repository<MachineReplacement>,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    query: QueryReplacementsDto,
    scope: BranchScope,
  ): Promise<PaginatedResult<MachineReplacement>> {
    const qb = this.baseQuery();

    // Scoped on the *new* machine's branch: the replacement that matters to a supervisor is the
    // one that put a unit in his branch. The old serial is history and often belongs to nobody.
    if (!scope.unrestricted) {
      qb.andWhere('newMachine.current_branch_id = :scopeBranch', {
        scopeBranch: scope.branchId,
      });
    }

    if (query.machineId) {
      qb.andWhere(
        '(replacement.old_machine_id = :machineId OR replacement.new_machine_id = :machineId)',
        { machineId: query.machineId },
      );
    }

    if (query.maintenanceOrderId) {
      qb.andWhere('replacement.maintenance_order_id = :orderId', {
        orderId: query.maintenanceOrderId,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('replacement.replaced_at >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('replacement.replaced_at <= :dateTo', { dateTo: query.dateTo });
    }

    qb.orderBy('replacement.replacedAt', query.order).addOrderBy('replacement.id', 'ASC');
    qb.skip(query.skip).take(query.take);

    const [rows, total] = await qb.getManyAndCount();

    return new PaginatedResult(rows, total, query.page, query.limit);
  }

  /**
   * Writes the swap: a new machine record inheriting the asset's economics, a bonded battery for
   * it, the old record closed off as `REPLACED`, and the link row that joins the two.
   */
  async perform(context: ReplacementContext, manager: EntityManager): Promise<ReplacementOutcome> {
    const { oldMachine, dto, actorId } = context;

    this.assertReplaceable(oldMachine);
    await this.assertSerialsAreFree(manager, dto);

    const model = await this.resolveModel(manager, oldMachine, dto);
    const warehouse = await this.companyWarehouse(manager);

    const machines = manager.getRepository(Machine);

    const newMachine = await machines.save(
      machines.create({
        serial: dto.newSerial,
        simSerial: dto.newSimSerial ?? null,
        boxSerial: dto.newBoxSerial ?? null,
        qrPayload: null,
        machineModelId: model.id,
        machineTypeId: model.machineTypeId,
        // Copied, not re-entered: it is the same commercial asset for costing, and its age does
        // not reset because the factory handed over a different box (`12`, step 3).
        purchasePrice: oldMachine.purchasePrice,
        purchaseDate: oldMachine.purchaseDate,
        factoryInvoiceNo: oldMachine.factoryInvoiceNo,
        warrantyStart: dto.newWarrantyStart ?? null,
        warrantyEnd: dto.newWarrantyEnd ?? null,
        hasBox: dto.hasBox,
        status: MachineStatus.IN_COMPANY_WAREHOUSE,
        currentHolderType: PartyType.WAREHOUSE,
        currentHolderId: warehouse.id,
        currentWarehouseId: warehouse.id,
        // No branch: the replacement has to be issued out through a normal `COMPANY_TO_BRANCH`
        // hand-off, it does not teleport back to the merchant (`12`, rule 3).
        currentBranchId: null,
        // A fresh unit carries no repair history. The *chain* total is what the Director reads,
        // and that is computed across the links rather than accumulated onto the new row.
        totalRepairCost: '0',
        repairCount: 0,
        replacesMachineId: oldMachine.id,
        createdBy: actorId,
      }),
    );

    const batteries = manager.getRepository(Battery);
    await batteries.save(
      batteries.create({
        serial: dto.newBattery.serial,
        machineId: newMachine.id,
        isActive: true,
        createdBy: actorId,
      }),
    );

    await machines.update(oldMachine.id, {
      status: MachineStatus.REPLACED,
      replacedByMachineId: newMachine.id,
      // The old unit stayed with the factory. Holder columns say so rather than leaving it
      // looking like it is still on a shelf somebody could pick it off.
      currentHolderType: PartyType.FACTORY,
      currentHolderId: null,
      currentWarehouseId: null,
      updatedBy: actorId,
    });

    const repo = manager.getRepository(MachineReplacement);
    const replacement = await repo.save(
      repo.create({
        oldMachineId: oldMachine.id,
        newMachineId: newMachine.id,
        maintenanceOrderId: context.maintenanceOrderId,
        reason: dto.reason,
        replacedAt: new Date(dto.replacedAt),
        createdBy: actorId,
      }),
    );

    await this.audit.record({
      userId: actorId,
      action: AuditAction.MACHINE_REPLACED,
      entityType: AuditEntityType.REPLACEMENT,
      entityId: replacement.id,
      after: {
        oldMachineId: oldMachine.id,
        newMachineId: newMachine.id,
        oldSerial: oldMachine.serial,
        newSerial: newMachine.serial,
        reason: dto.reason,
      },
    });

    return { replacementId: replacement.id, newMachineId: newMachine.id };
  }

  findById(id: string): Promise<MachineReplacement | null> {
    return this.baseQuery().andWhere('replacement.id = :id', { id }).getOne();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private baseQuery(): SelectQueryBuilder<MachineReplacement> {
    return this.replacements
      .createQueryBuilder('replacement')
      .innerJoinAndSelect('replacement.oldMachine', 'oldMachine')
      .innerJoinAndSelect('replacement.newMachine', 'newMachine');
  }

  private assertReplaceable(machine: Machine): void {
    if (machine.replacedByMachineId !== null || machine.status === MachineStatus.REPLACED) {
      throw AppException.conflict(ErrorCode.MACHINE_ALREADY_REPLACED, { serial: machine.serial });
    }

    if (machine.status === MachineStatus.DECOMMISSIONED) {
      throw AppException.unprocessable(ErrorCode.MACHINE_RETIRED, { serial: machine.serial });
    }

    if (!REPLACEABLE_STATUSES.includes(machine.status)) {
      throw AppException.unprocessable(ErrorCode.INVALID_MACHINE_STATUS, {
        serial: machine.serial,
        status: machine.status,
      });
    }
  }

  /**
   * A swapped SIM is a replacement rather than an edit (`07`, rule 1), so this is the only path by
   * which a machine's SIM serial ever changes — and the only place the new one can be checked.
   */
  private async assertSerialsAreFree(
    manager: EntityManager,
    dto: ReplacementMachineDto,
  ): Promise<void> {
    const machines = manager.getRepository(Machine);

    if (await machines.findOne({ where: { serial: dto.newSerial } })) {
      throw AppException.conflict(ErrorCode.SERIAL_EXISTS, { serial: dto.newSerial });
    }

    if (dto.newSimSerial && (await machines.findOne({ where: { simSerial: dto.newSimSerial } }))) {
      throw AppException.conflict(ErrorCode.SIM_SERIAL_EXISTS, { serial: dto.newSimSerial });
    }

    if (dto.newBoxSerial && (await machines.findOne({ where: { boxSerial: dto.newBoxSerial } }))) {
      throw AppException.conflict(ErrorCode.BOX_SERIAL_EXISTS, { serial: dto.newBoxSerial });
    }

    const battery = await manager
      .getRepository(Battery)
      .findOne({ where: { serial: dto.newBattery.serial } });

    if (battery) {
      throw AppException.conflict(ErrorCode.BATTERY_SERIAL_EXISTS, {
        serial: dto.newBattery.serial,
      });
    }
  }

  /**
   * The model, and with it the type. Inherited unless the DTO overrides it — the factory
   * sometimes substitutes a newer model — and the SIM rule is re-checked against whichever type
   * wins, because a `PIN_PAD` replacing a POS terminal has no line to trace.
   */
  private async resolveModel(
    manager: EntityManager,
    oldMachine: Machine,
    dto: ReplacementMachineDto,
  ): Promise<MachineModel> {
    const model = await manager.getRepository(MachineModel).findOne({
      where: { id: dto.machineModelId ?? oldMachine.machineModelId },
      relations: { machineType: true },
    });

    if (!model) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          {
            field: 'replacement.machineModelId',
            value: dto.machineModelId,
            constraint: 'unknown machine model',
          },
        ],
      });
    }

    if (model.machineType.requiresSim && !dto.newSimSerial) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          { field: 'replacement.newSimSerial', constraint: 'required for this machine type' },
        ],
      });
    }

    if (!model.machineType.requiresSim && dto.newSimSerial) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          {
            field: 'replacement.newSimSerial',
            value: dto.newSimSerial,
            constraint: 'not applicable for this machine type',
          },
        ],
      });
    }

    return model;
  }

  private async companyWarehouse(manager: EntityManager): Promise<Warehouse> {
    const warehouse = await manager
      .getRepository(Warehouse)
      .findOne({ where: { type: WarehouseType.COMPANY_MAIN, isActive: true } });

    if (!warehouse) {
      throw AppException.unprocessable(ErrorCode.WAREHOUSE_TYPE_CONFLICT, {
        expected: WarehouseType.COMPANY_MAIN,
        actual: 'none',
      });
    }

    return warehouse;
  }
}
