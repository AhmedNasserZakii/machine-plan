import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { Locale } from 'src/common/constants/locales';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import { TERMINAL_MACHINE_STATUSES } from 'src/common/enums/machine-status.enum';
// A leaf constants file, not the transfers module: "which holder types are a person" is one
// fact, and restating it here is how the two copies would end up disagreeing.
import { USER_PARTIES } from 'src/modules/transfers/transfer-parties';
import { AppException, ErrorDetail } from 'src/common/errors';
import { BranchScope } from 'src/common/types/request.types';
import { joinTranslation, likePattern } from 'src/common/utils';
import { MachineModel } from 'src/modules/lookups/entities/machine-model.entity';
import { MatchedOn } from './dto/responses/machine.response';
import {
  BulkCreateMachinesDto,
  CreateMachineDto,
  QueryMachinesDto,
  UpdateMachineDto,
} from './dto/machine.dto';
import { Battery } from './entities/battery.entity';
import { Machine } from './entities/machine.entity';

/** The four serials a scan can resolve to, in the fixed order the plan pins (`07`, lookup order). */
const LOOKUP_ORDER: readonly { column: string; matchedOn: MatchedOn }[] = [
  { column: 'machine.serial', matchedOn: 'MACHINE' },
  { column: 'battery.serial', matchedOn: 'BATTERY' },
  { column: 'machine.sim_serial', matchedOn: 'SIM' },
  { column: 'machine.box_serial', matchedOn: 'BOX' },
];

/** Serials are part of a unit's identity, so a `PATCH` naming one is an error, not a no-op. */
const IMMUTABLE_FIELDS = ['serial', 'simSerial', 'boxSerial'] as const;

/**
 * Both create paths share one validator, but their request bodies do not have the same shape, and
 * an error pointing at `machines[0].simSerial` for a body with no `machines` array sends the
 * client's form binding looking for a field that does not exist.
 */
type FieldPath = (index: number, field: string) => string;

const singleFieldPath: FieldPath = (_index, field) => field;
const bulkFieldPath: FieldPath = (index, field) => `machines[${index}].${field}`;

export interface MachineLookupResult {
  matchedOn: MatchedOn;
  machine: Machine;
}

@Injectable()
export class MachinesService {
  constructor(
    @InjectRepository(Machine) private readonly machines: Repository<Machine>,
    @InjectRepository(Battery) private readonly batteries: Repository<Battery>,
    @InjectRepository(MachineModel) private readonly models: Repository<MachineModel>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    query: QueryMachinesDto,
    scope: BranchScope,
    locale: Locale,
  ): Promise<PaginatedResult<Machine>> {
    const qb = this.baseQuery(locale);

    // A supervisor or representative only ever sees their own branch's fleet. The guard has
    // already rejected an explicit cross-branch request, so this is a filter, not a check.
    const branchId = scope.unrestricted ? query.branchId : scope.branchId;
    if (branchId) {
      qb.andWhere('machine.current_branch_id = :branchId', { branchId });
    }

    if (!query.includeRetired) {
      qb.andWhere('machine.status NOT IN (:...retired)', { retired: TERMINAL_MACHINE_STATUSES });
    }

    if (query.status?.length) {
      qb.andWhere('machine.status IN (:...statuses)', { statuses: query.status });
    }

    if (query.machineTypeId) {
      qb.andWhere('machine.machine_type_id = :typeId', { typeId: query.machineTypeId });
    }

    if (query.machineModelId) {
      qb.andWhere('machine.machine_model_id = :modelId', { modelId: query.machineModelId });
    }

    if (query.holderType) {
      qb.andWhere('machine.current_holder_type = :holderType', { holderType: query.holderType });
    }

    if (query.holderId) {
      qb.andWhere('machine.current_holder_id = :holderId', { holderId: query.holderId });
    }

    if (query.warrantyExpiringBefore) {
      qb.andWhere('machine.warranty_end IS NOT NULL').andWhere('machine.warranty_end < :before', {
        before: query.warrantyExpiringBefore,
      });
    }

    if (query.minRepairCost !== undefined) {
      qb.andWhere('machine.total_repair_cost >= :minCost', { minCost: query.minRepairCost });
    }

    // "Nothing has happened to this machine in N days" is the sweep that finds units sitting in a
    // representative's car. Until transfers land, `updated_at` is the only movement signal there is.
    if (query.idleSinceDays !== undefined) {
      qb.andWhere(`machine.updated_at < NOW() - (:idleDays * INTERVAL '1 day')`, {
        idleDays: query.idleSinceDays,
      });
    }

    if (query.search) {
      this.applySerialSearch(qb, query.search);
    }

    qb.orderBy(`machine.${query.sortBy}`, query.order).addOrderBy('machine.id', 'ASC');
    qb.skip(query.skip).take(query.take);

    const [items, total] = await qb.getManyAndCount();
    return new PaginatedResult(items, total, query.page, query.limit);
  }

  async findById(id: string, scope: BranchScope, locale: Locale): Promise<Machine> {
    const machine = await this.baseQuery(locale).where('machine.id = :id', { id }).getOne();

    return this.assertVisible(machine, scope);
  }

  async findBySerial(serial: string, scope: BranchScope, locale: Locale): Promise<Machine> {
    const machine = await this.baseQuery(locale)
      .where('machine.serial = :serial', { serial })
      .getOne();

    return this.assertVisible(machine, scope);
  }

  /**
   * Resolves a scanned code against all four serials. The columns are searched in a fixed order
   * rather than in one `OR`, so a code that is one machine's serial and another's box serial
   * always resolves the same way — and the caller is told which sticker it read, because the
   * battery label sits next to the machine label and people scan the wrong one.
   */
  async lookup(code: string, scope: BranchScope, locale: Locale): Promise<MachineLookupResult> {
    for (const { column, matchedOn } of LOOKUP_ORDER) {
      const machine = await this.baseQuery(locale).where(`${column} = :code`, { code }).getOne();

      if (machine) {
        return { matchedOn, machine: this.assertVisible(machine, scope) };
      }
    }

    throw AppException.notFound(ErrorCode.MACHINE_NOT_FOUND);
  }

  /**
   * What the caller is physically holding — the fleet an offline device has to know about
   * (`20`, bootstrap). `since` narrows it to what has changed, for the delta call.
   *
   * Custody rather than branch: a representative works out of his car, and the machines sitting
   * in his branch's warehouse are not ones he can hand over without a transfer he cannot create
   * offline anyway.
   */
  async inCustodyOf(
    userId: string,
    locale: Locale,
    since?: Date,
    take?: number,
    orderByUpdatedAt = false,
  ): Promise<Machine[]> {
    const qb = this.baseQuery(locale)
      .where('machine.current_holder_type IN (:...holderTypes)', { holderTypes: USER_PARTIES })
      .andWhere('machine.current_holder_id = :userId', { userId });

    if (since) {
      qb.andWhere('machine.updated_at > :since', { since });
    }

    if (orderByUpdatedAt) {
      qb.orderBy('machine.updatedAt', 'ASC').addOrderBy('machine.id', 'ASC');
    } else {
      qb.orderBy('machine.serial', 'ASC').addOrderBy('machine.id', 'ASC');
    }

    if (take !== undefined) qb.take(take);

    return qb.getMany();
  }

  /**
   * Machines that have left the caller's hands since `since`, so the device can drop them.
   *
   * Anything that moved was updated, so this is the complement of `inCustodyOf` over the same
   * window. It can name a machine the client never held, which costs a client-side delete that
   * finds nothing — the alternative is leaving a unit on the device that somebody else now has.
   */
  async releasedFromCustody(userId: string, since: Date): Promise<string[]> {
    const rows = await this.machines
      .createQueryBuilder('machine')
      .select('machine.id', 'id')
      .where('machine.updated_at > :since', { since })
      .andWhere(
        '(machine.current_holder_id IS NULL OR machine.current_holder_id <> :userId OR machine.current_holder_type NOT IN (:...holderTypes))',
        { userId, holderTypes: USER_PARTIES },
      )
      .getRawMany<{ id: string }>();

    return rows.map((row) => row.id);
  }

  async create(dto: CreateMachineDto, actorId: string, locale: Locale): Promise<Machine> {
    const [created] = await this.createMany([dto], actorId, singleFieldPath);
    return this.findById(created, { branchId: null, unrestricted: true }, locale);
  }

  /**
   * Factory intake. The whole batch is validated before anything is written and committed in one
   * transaction: a partial import would leave the operator guessing which of 300 units made it in,
   * with no way to re-run the file without tripping duplicate serials.
   */
  async bulkCreate(
    dto: BulkCreateMachinesDto,
    actorId: string,
    locale: Locale,
  ): Promise<Machine[]> {
    const ids = await this.createMany(dto.machines, actorId, bulkFieldPath);

    const machines = await this.baseQuery(locale)
      .where('machine.id IN (:...ids)', { ids })
      .getMany();

    // `IN` does not preserve order, and the operator reads the response against their file.
    const byId = new Map(machines.map((machine) => [machine.id, machine]));
    return ids.map((id) => byId.get(id)!);
  }

  async update(
    id: string,
    dto: UpdateMachineDto,
    scope: BranchScope,
    actorId: string,
    locale: Locale,
  ): Promise<Machine> {
    this.assertNoSerialEdit(dto);

    // Scoped like every read path. Hard-coding `unrestricted` here let a branch supervisor
    // edit any machine in the fleet by id, including ones he can neither see nor list.
    const machine = await this.findById(id, scope, locale);

    // Moving a machine to a model of a different type would change whether it needs a SIM, and
    // the SIM cannot be edited to match — so the type has to stay put.
    let machineTypeId = machine.machineTypeId;
    if (dto.machineModelId && dto.machineModelId !== machine.machineModelId) {
      const model = await this.loadModel(dto.machineModelId);

      if (model.machineTypeId !== machine.machineTypeId) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, {
          details: [
            {
              field: 'machineModelId',
              value: dto.machineModelId,
              constraint: 'must belong to the same machine type',
            },
          ],
        });
      }

      machineTypeId = model.machineTypeId;
    }

    const patch = {
      ...(dto.machineModelId !== undefined
        ? { machineModelId: dto.machineModelId, machineTypeId }
        : {}),
      ...(dto.qrPayload !== undefined ? { qrPayload: dto.qrPayload } : {}),
      ...(dto.purchasePrice !== undefined ? { purchasePrice: String(dto.purchasePrice) } : {}),
      ...(dto.purchaseDate !== undefined ? { purchaseDate: dto.purchaseDate } : {}),
      ...(dto.factoryInvoiceNo !== undefined ? { factoryInvoiceNo: dto.factoryInvoiceNo } : {}),
      ...(dto.warrantyStart !== undefined ? { warrantyStart: dto.warrantyStart } : {}),
      ...(dto.warrantyEnd !== undefined ? { warrantyEnd: dto.warrantyEnd } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      updatedBy: actorId,
    };

    await this.machines.update(id, patch);

    await this.audit.record({
      userId: actorId,
      action: AuditAction.MACHINE_UPDATED,
      entityType: AuditEntityType.MACHINE,
      entityId: id,
      before: {
        machineModelId: machine.machineModelId,
        qrPayload: machine.qrPayload,
        purchasePrice: machine.purchasePrice,
        purchaseDate: machine.purchaseDate,
        factoryInvoiceNo: machine.factoryInvoiceNo,
        warrantyStart: machine.warrantyStart,
        warrantyEnd: machine.warrantyEnd,
        notes: machine.notes,
      },
      after: {
        machineModelId: patch.machineModelId ?? machine.machineModelId,
        qrPayload: 'qrPayload' in patch ? patch.qrPayload : machine.qrPayload,
        purchasePrice: 'purchasePrice' in patch ? patch.purchasePrice : machine.purchasePrice,
        purchaseDate: 'purchaseDate' in patch ? patch.purchaseDate : machine.purchaseDate,
        factoryInvoiceNo:
          'factoryInvoiceNo' in patch ? patch.factoryInvoiceNo : machine.factoryInvoiceNo,
        warrantyStart: 'warrantyStart' in patch ? patch.warrantyStart : machine.warrantyStart,
        warrantyEnd: 'warrantyEnd' in patch ? patch.warrantyEnd : machine.warrantyEnd,
        notes: 'notes' in patch ? patch.notes : machine.notes,
      },
    });

    return this.findById(id, scope, locale);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private baseQuery(locale: Locale): SelectQueryBuilder<Machine> {
    const qb = this.machines
      .createQueryBuilder('machine')
      .leftJoinAndSelect('machine.battery', 'battery')
      .leftJoinAndSelect('machine.currentBranch', 'branch')
      .leftJoinAndSelect('machine.machineType', 'type')
      .leftJoinAndSelect('machine.machineModel', 'model');

    joinTranslation(qb, 'type', 'translations', locale);
    joinTranslation(qb, 'model', 'translations', locale);

    return qb;
  }

  /**
   * One `ILIKE` across the four serial columns. Grouped in a `Brackets` so it cannot swallow the
   * status and branch filters it is combined with.
   */
  private applySerialSearch(qb: SelectQueryBuilder<Machine>, search: string): void {
    qb.andWhere(
      new Brackets((where) => {
        where
          .where('machine.serial ILIKE :search')
          .orWhere('machine.sim_serial ILIKE :search')
          .orWhere('machine.box_serial ILIKE :search')
          .orWhere('battery.serial ILIKE :search');
      }),
      { search: likePattern(search) },
    );
  }

  /** Turns "not found" and "not yours" into the same 404, so ids cannot be probed across branches. */
  private assertVisible(machine: Machine | null, scope: BranchScope): Machine {
    if (!machine) {
      throw AppException.notFound(ErrorCode.MACHINE_NOT_FOUND);
    }

    if (!scope.unrestricted && machine.currentBranchId !== scope.branchId) {
      throw AppException.notFound(ErrorCode.MACHINE_NOT_FOUND);
    }

    return machine;
  }

  private assertNoSerialEdit(dto: UpdateMachineDto): void {
    const offending = IMMUTABLE_FIELDS.filter((field) => dto[field] !== undefined);

    if (offending.length > 0) {
      throw new AppException(ErrorCode.SERIAL_IMMUTABLE, {
        status: 422,
        details: offending.map((field) => ({
          field,
          constraint: 'immutable; a new serial is a replacement, not an edit',
        })),
      });
    }
  }

  private async loadModel(machineModelId: string): Promise<MachineModel> {
    const model = await this.models.findOne({
      where: { id: machineModelId },
      relations: { machineType: true },
    });

    if (!model) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          { field: 'machineModelId', value: machineModelId, constraint: 'unknown machine model' },
        ],
      });
    }

    return model;
  }

  /**
   * The shared write path for both single create and bulk intake. Everything that can be checked
   * without writing is checked first — model existence, SIM applicability, duplicates inside the
   * batch, duplicates already in the database — and only then does a single transaction commit.
   */
  private async createMany(
    rows: CreateMachineDto[],
    actorId: string,
    path: FieldPath,
  ): Promise<string[]> {
    const models = await this.loadModels(rows, path);

    const details: ErrorDetail[] = [];
    rows.forEach((row, index) => {
      details.push(...this.validateSim(row, models.get(row.machineModelId)!, index, path));
    });
    details.push(...this.findDuplicatesWithin(rows, path));

    if (details.length > 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details });
    }

    await this.assertSerialsAreFree(rows);

    return this.dataSource.transaction(async (manager) => {
      const ids: string[] = [];

      for (const row of rows) {
        ids.push(await this.insertOne(manager, row, models.get(row.machineModelId)!, actorId));
      }

      return ids;
    });
  }

  private async loadModels(
    rows: CreateMachineDto[],
    path: FieldPath,
  ): Promise<Map<string, MachineModel>> {
    const ids = [...new Set(rows.map((row) => row.machineModelId))];

    const models = await this.models.find({
      where: { id: In(ids) },
      relations: { machineType: true },
    });

    const byId = new Map(models.map((model) => [model.id, model]));

    const details: ErrorDetail[] = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !byId.has(row.machineModelId))
      .map(({ row, index }) => ({
        field: path(index, 'machineModelId'),
        value: row.machineModelId,
        constraint: 'unknown machine model',
      }));

    if (details.length > 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details });
    }

    return byId;
  }

  /**
   * A SIM is required or forbidden by the machine type, never optional: a POS without a SIM serial
   * cannot be traced to a line, and a `PIN_PAD` with one means someone typed into the wrong field.
   */
  private validateSim(
    row: CreateMachineDto,
    model: MachineModel,
    index: number,
    path: FieldPath,
  ): ErrorDetail[] {
    const field = path(index, 'simSerial');

    if (model.machineType.requiresSim && !row.simSerial) {
      return [{ field, constraint: 'required for this machine type' }];
    }

    if (!model.machineType.requiresSim && row.simSerial) {
      return [{ field, value: row.simSerial, constraint: 'not applicable for this machine type' }];
    }

    return [];
  }

  /** A pasted spreadsheet repeats rows more often than it collides with the database. */
  private findDuplicatesWithin(rows: CreateMachineDto[], path: FieldPath): ErrorDetail[] {
    const details: ErrorDetail[] = [];

    const checks: { field: string; value: (row: CreateMachineDto) => string | undefined }[] = [
      { field: 'serial', value: (row) => row.serial },
      { field: 'battery.serial', value: (row) => row.battery.serial },
      { field: 'simSerial', value: (row) => row.simSerial },
      { field: 'boxSerial', value: (row) => row.boxSerial },
    ];

    for (const check of checks) {
      const seen = new Map<string, number>();

      rows.forEach((row, index) => {
        const value = check.value(row);
        if (!value) return;

        const first = seen.get(value);
        if (first === undefined) {
          seen.set(value, index);
          return;
        }

        details.push({
          field: path(index, check.field),
          value,
          constraint: `duplicated in this batch (also row ${first})`,
        });
      });
    }

    return details;
  }

  /**
   * Checked up front rather than left to the unique indexes, because a 500-row intake that fails
   * on row 400 should say which serial is already taken, not surface a driver error.
   */
  /**
   * Pre-flight uniqueness check, for a sentence naming the serial rather than a constraint
   * name. The unique indexes remain the actual guarantee — two concurrent creates both pass
   * this and the loser hits the index, which `AllExceptionsFilter` maps to a 409.
   *
   * Deliberately *not* `withDeleted`: the partial unique indexes exclude soft-deleted rows,
   * so including them here refused serials the database would have accepted — a physical
   * machine could not be re-registered after being written off, with no way to resolve it
   * through the API.
   */
  private async assertSerialsAreFree(rows: CreateMachineDto[]): Promise<void> {
    const serials = rows.map((row) => row.serial);
    const simSerials = rows.map((row) => row.simSerial).filter((value) => !!value) as string[];
    const boxSerials = rows.map((row) => row.boxSerial).filter((value) => !!value) as string[];
    const batterySerials = rows.map((row) => row.battery.serial);

    const existingSerial = await this.machines.findOne({ where: { serial: In(serials) } });
    if (existingSerial) {
      throw AppException.conflict(ErrorCode.SERIAL_EXISTS, { serial: existingSerial.serial });
    }

    if (simSerials.length > 0) {
      const existing = await this.machines.findOne({ where: { simSerial: In(simSerials) } });
      if (existing) {
        throw AppException.conflict(ErrorCode.SIM_SERIAL_EXISTS, { serial: existing.simSerial! });
      }
    }

    if (boxSerials.length > 0) {
      const existing = await this.machines.findOne({ where: { boxSerial: In(boxSerials) } });
      if (existing) {
        throw AppException.conflict(ErrorCode.BOX_SERIAL_EXISTS, { serial: existing.boxSerial! });
      }
    }

    const existingBattery = await this.batteries.findOne({
      where: { serial: In(batterySerials) },
    });
    if (existingBattery) {
      throw AppException.conflict(ErrorCode.BATTERY_SERIAL_EXISTS, {
        serial: existingBattery.serial,
      });
    }
  }

  private async insertOne(
    manager: EntityManager,
    row: CreateMachineDto,
    model: MachineModel,
    actorId: string,
  ): Promise<string> {
    const machines = manager.getRepository(Machine);
    const batteries = manager.getRepository(Battery);

    const machine = await machines.save(
      machines.create({
        serial: row.serial,
        simSerial: row.simSerial ?? null,
        boxSerial: row.boxSerial ?? null,
        // The sticker usually encodes the serial itself; storing it twice would just be one more
        // copy to keep in step.
        qrPayload: row.qrPayload ?? null,
        machineModelId: model.id,
        machineTypeId: model.machineTypeId,
        purchasePrice: row.purchasePrice !== undefined ? String(row.purchasePrice) : null,
        purchaseDate: row.purchaseDate ?? null,
        factoryInvoiceNo: row.factoryInvoiceNo ?? null,
        warrantyStart: row.warrantyStart ?? null,
        warrantyEnd: row.warrantyEnd ?? null,
        hasBox: row.hasBox,
        notes: row.notes ?? null,
        createdBy: actorId,
      }),
    );

    const battery = await batteries.save(
      batteries.create({
        serial: row.battery.serial,
        machineId: machine.id,
        isActive: true,
        createdBy: actorId,
      }),
    );

    await this.audit.record({
      userId: actorId,
      action: AuditAction.MACHINE_CREATED,
      entityType: AuditEntityType.MACHINE,
      entityId: machine.id,
      after: { serial: machine.serial, machineModelId: machine.machineModelId },
    });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.BATTERY_CREATED,
      entityType: AuditEntityType.BATTERY,
      entityId: battery.id,
      after: { serial: battery.serial, machineId: machine.id },
    });

    return machine.id;
  }
}
