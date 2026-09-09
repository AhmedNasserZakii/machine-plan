import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import { WarehouseType } from 'src/common/enums/operations.enum';
import { AppException } from 'src/common/errors';
import { CreateWarehouseDto, QueryWarehousesDto } from './dto/warehouse.dto';
import { Branch } from './entities/branch.entity';
import { Warehouse } from './entities/warehouse.entity';

/** The company-level types must not be attached to a branch. */
const COMPANY_LEVEL_TYPES: readonly WarehouseType[] = [
  WarehouseType.COMPANY_MAIN,
  WarehouseType.SCRAP,
  WarehouseType.MAINTENANCE,
];

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse) private readonly warehouses: Repository<Warehouse>,
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: QueryWarehousesDto): Promise<Warehouse[]> {
    const qb = this.warehouses
      .createQueryBuilder('warehouse')
      .leftJoinAndSelect('warehouse.branch', 'branch');

    if (query.type) qb.andWhere('warehouse.type = :type', { type: query.type });
    if (query.branchId)
      qb.andWhere('warehouse.branch_id = :branchId', { branchId: query.branchId });
    if (!query.includeInactive) qb.andWhere('warehouse.is_active = true');

    return qb.orderBy('warehouse.type', 'ASC').addOrderBy('warehouse.name', 'ASC').getMany();
  }

  async findById(id: string): Promise<Warehouse> {
    const warehouse = await this.warehouses.findOne({
      where: { id },
      relations: { branch: true },
    });

    if (!warehouse) throw AppException.notFound();
    return warehouse;
  }

  /** Resolves a well-known singleton warehouse; transfers rely on these being present. */
  async findByType(type: WarehouseType): Promise<Warehouse> {
    const warehouse = await this.warehouses.findOne({
      where: { type, branchId: IsNull() },
    });

    if (!warehouse) throw AppException.notFound();
    return warehouse;
  }

  async create(dto: CreateWarehouseDto, actorId: string): Promise<Warehouse> {
    await this.assertBranchPairing(dto.type, dto.branchId ?? null);
    await this.assertTypeAvailable(dto.type, dto.branchId ?? null);

    const warehouse = await this.warehouses.save(
      this.warehouses.create({
        type: dto.type,
        name: dto.name,
        branchId: dto.branchId ?? null,
        isActive: true,
        createdBy: actorId,
      }),
    );

    await this.audit.record({
      userId: actorId,
      action: AuditAction.WAREHOUSE_CREATED,
      entityType: AuditEntityType.WAREHOUSE,
      entityId: warehouse.id,
      after: { type: dto.type, name: dto.name, branchId: dto.branchId ?? null },
    });

    return this.findById(warehouse.id);
  }

  /**
   * Creates the warehouse that belongs to a new branch. Runs inside the caller's transaction so
   * a branch is never persisted without the warehouse the transfer rules assume it has.
   */
  createForBranch(
    manager: EntityManager,
    branch: Branch,
    name: string | undefined,
    actorId: string,
  ): Promise<Warehouse> {
    const repository = manager.getRepository(Warehouse);

    return repository.save(
      repository.create({
        type: WarehouseType.BRANCH,
        name: name ?? `مخزن ${branch.name}`,
        branchId: branch.id,
        isActive: true,
        createdBy: actorId,
      }),
    );
  }

  /**
   * Mirrors the partial unique indexes so a conflict comes back as a typed error instead of a
   * raw driver violation. The indexes remain the real guard against a concurrent duplicate.
   */
  private async assertTypeAvailable(type: WarehouseType, branchId: string | null): Promise<void> {
    if (type === WarehouseType.MAINTENANCE) return;

    const existing =
      type === WarehouseType.BRANCH
        ? await this.warehouses.findOne({ where: { type, branchId: branchId ?? IsNull() } })
        : await this.warehouses.findOne({ where: { type } });

    if (existing) {
      throw AppException.conflict(ErrorCode.WAREHOUSE_TYPE_CONFLICT, { type });
    }
  }

  private async assertBranchPairing(type: WarehouseType, branchId: string | null): Promise<void> {
    if (type === WarehouseType.BRANCH) {
      if (!branchId) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, {
          details: [{ field: 'branchId', constraint: 'required for a BRANCH warehouse' }],
        });
      }

      const exists = await this.branches.exists({ where: { id: branchId } });
      if (!exists) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, {
          details: [{ field: 'branchId', value: branchId, constraint: 'unknown branch' }],
        });
      }
      return;
    }

    if (COMPANY_LEVEL_TYPES.includes(type) && branchId) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'branchId', constraint: `must be null for a ${type} warehouse` }],
      });
    }
  }
}
