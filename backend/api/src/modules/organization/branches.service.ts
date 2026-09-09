import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import { WarehouseType } from 'src/common/enums/operations.enum';
import { AppException } from 'src/common/errors';
import { BranchScope } from 'src/common/types/request.types';
import { likePattern } from 'src/common/utils';
import { SystemRole } from 'src/modules/roles/entities/role.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { BRANCH_STATS_PORT, BranchStatsPort } from './branch-stats.port';
import { CreateBranchDto, QueryBranchesDto, UpdateBranchDto } from './dto/branch.dto';
import { BranchSummaryResponse } from './dto/responses/branch.response';
import { Branch } from './entities/branch.entity';
import { Warehouse } from './entities/warehouse.entity';
import { WarehousesService } from './warehouses.service';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly warehouses: WarehousesService,
    private readonly dataSource: DataSource,
    @Inject(BRANCH_STATS_PORT) private readonly stats: BranchStatsPort,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: QueryBranchesDto): Promise<Branch[]> {
    const qb = this.branches
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.warehouses', 'warehouse', 'warehouse.type = :branchType', {
        branchType: WarehouseType.BRANCH,
      });

    if (!query.includeInactive) qb.andWhere('branch.is_active = true');

    if (query.search) {
      qb.andWhere('(branch.code ILIKE :search OR branch.name ILIKE :search)', {
        search: likePattern(query.search),
      });
    }

    return qb.orderBy('branch.name', 'ASC').getMany();
  }

  async findById(id: string): Promise<Branch> {
    const branch = await this.branches
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.warehouses', 'warehouse', 'warehouse.type = :branchType', {
        branchType: WarehouseType.BRANCH,
      })
      .where('branch.id = :id', { id })
      .getOne();

    if (!branch) throw AppException.notFound();
    return branch;
  }

  /** Confirms a branch exists, for other modules validating a `branchId` they were handed. */
  async assertExists(branchId: string): Promise<void> {
    const exists = await this.branches.exists({ where: { id: branchId } });
    if (!exists) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'branchId', value: branchId, constraint: 'unknown branch' }],
      });
    }
  }

  /**
   * A branch and its warehouse are created together: the transfer rules assume every branch has
   * exactly one, so splitting this into two calls would allow an unusable intermediate state.
   */
  async create(dto: CreateBranchDto, actorId: string): Promise<Branch> {
    const existing = await this.branches.findOne({
      where: { code: dto.code },
      withDeleted: true,
    });

    if (existing) {
      throw AppException.conflict(ErrorCode.BRANCH_CODE_EXISTS, { code: dto.code });
    }

    const branchId = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Branch);
      const branch = await repository.save(
        repository.create({
          code: dto.code,
          name: dto.name,
          address: dto.address ?? null,
          phone: dto.phone ?? null,
          isActive: true,
          createdBy: actorId,
        }),
      );

      await this.warehouses.createForBranch(manager, branch, dto.warehouseName, actorId);
      return branch.id;
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.BRANCH_CREATED,
      entityType: AuditEntityType.BRANCH,
      entityId: branchId,
      after: {
        code: dto.code,
        name: dto.name,
        address: dto.address ?? null,
        phone: dto.phone ?? null,
      },
    });

    return this.findById(branchId);
  }

  async update(id: string, dto: UpdateBranchDto, actorId: string): Promise<Branch> {
    const before = await this.findById(id);

    await this.branches.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      updatedBy: actorId,
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.BRANCH_UPDATED,
      entityType: AuditEntityType.BRANCH,
      entityId: id,
      before: { name: before.name, address: before.address, phone: before.phone },
      after: {
        name: dto.name ?? before.name,
        address: dto.address !== undefined ? dto.address : before.address,
        phone: dto.phone !== undefined ? dto.phone : before.phone,
      },
    });

    return this.findById(id);
  }

  /**
   * Blocked while the branch still holds machines or active staff, because both would be left
   * pointing at an inactive branch with no way to hand them over
   * (`06-feature-branches-warehouses.md` rule 2).
   */
  async deactivate(id: string, actorId: string): Promise<Branch> {
    const branch = await this.findById(id);

    /*
     * Counts and write in one transaction, with the branch row locked.
     *
     * The emptiness checks are only meaningful if the branch cannot gain a machine or a
     * member of staff between the count and the update. `users.create` and the transfer
     * paths both read the branch to validate against it, so locking it here is what makes
     * them serialize against a deactivation instead of interleaving with it.
     */
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(Branch)
        .createQueryBuilder('branch')
        .where('branch.id = :id', { id: branch.id })
        .setLock('pessimistic_write')
        .getOne();

      const machineCount = await this.stats.countMachines(branch.id);
      if (machineCount > 0) {
        throw AppException.conflict(ErrorCode.BRANCH_HAS_MACHINES, { count: machineCount });
      }

      const staffCount = await manager.getRepository(User).count({
        where: { branchId: branch.id, isActive: true },
      });
      if (staffCount > 0) {
        throw AppException.conflict(ErrorCode.BRANCH_HAS_ACTIVE_STAFF, { count: staffCount });
      }

      await manager
        .getRepository(Branch)
        .update(branch.id, { isActive: false, updatedBy: actorId });
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.BRANCH_DEACTIVATED,
      entityType: AuditEntityType.BRANCH,
      entityId: branch.id,
      before: { isActive: true },
      after: { isActive: false },
    });

    return this.findById(branch.id);
  }

  async activate(id: string, actorId: string): Promise<Branch> {
    const branch = await this.findById(id);
    await this.branches.update(branch.id, { isActive: true, updatedBy: actorId });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.BRANCH_ACTIVATED,
      entityType: AuditEntityType.BRANCH,
      entityId: branch.id,
      before: { isActive: false },
      after: { isActive: true },
    });

    return this.findById(branch.id);
  }

  /**
   * The dashboard payload. `includeFinance` reflects the caller's `finance.read` permission —
   * when false the finance block is left off the response entirely rather than zeroed, so the
   * client can tell "not allowed to see" apart from "nothing spent".
   */
  async summary(
    id: string,
    scope: BranchScope,
    includeFinance: boolean,
  ): Promise<BranchSummaryResponse> {
    // Machine counts, staff headcount, open violations and the month's finance for one
    // branch. Unscoped, a branch supervisor could read any other branch's dashboard by id —
    // the same numbers his own scoped endpoints are careful not to show him.
    if (!scope.unrestricted && id !== scope.branchId) {
      throw AppException.notFound(ErrorCode.NOT_FOUND);
    }

    const branch = await this.findById(id);

    const [machines, openViolations, supervisors, representatives] = await Promise.all([
      this.stats.machineStats(branch.id),
      this.stats.countOpenViolations(branch.id),
      this.countStaffByRole(branch.id, SystemRole.BRANCH_SUPERVISOR),
      this.countStaffByRole(branch.id, SystemRole.REPRESENTATIVE),
    ]);

    const summary: BranchSummaryResponse = {
      branch: { id: branch.id, code: branch.code, name: branch.name },
      machines,
      staff: { supervisors, representatives },
      openViolations,
    };

    if (includeFinance) {
      summary.finance = await this.stats.monthFinance(branch.id);
    }

    return summary;
  }

  /** The single branch warehouse, or null when the list query did not load it. */
  branchWarehouse(branch: Branch): Warehouse | null {
    return branch.warehouses?.[0] ?? null;
  }

  private countStaffByRole(branchId: string, roleCode: string): Promise<number> {
    return this.users
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .where('user.branch_id = :branchId', { branchId })
      .andWhere('user.is_active = true')
      .andWhere('role.code = :roleCode', { roleCode })
      .getCount();
  }
}
