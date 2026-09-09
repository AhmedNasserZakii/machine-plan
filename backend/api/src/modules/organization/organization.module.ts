import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { Violation } from 'src/modules/violations/entities/violation.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { MachineBranchStatsAdapter } from './adapters/machine-branch-stats.adapter';
import { BRANCH_STATS_PORT } from './branch-stats.port';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { Branch } from './entities/branch.entity';
import { Warehouse } from './entities/warehouse.entity';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';

/**
 * Branches and warehouses. `User` is registered here for the staff counts that branch
 * deactivation and the summary need; it is a repository import rather than a `UsersModule`
 * import, which keeps the two modules free of a circular dependency (users validate their
 * `branchId` against this module's `Branch` repository).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Branch, Warehouse, User, Machine, Violation])],
  controllers: [BranchesController, WarehousesController],
  providers: [
    BranchesService,
    WarehousesService,
    // Machine and violation counts are real; finance still reports zero until
    // Phase 7 overrides that last method.
    { provide: BRANCH_STATS_PORT, useClass: MachineBranchStatsAdapter },
  ],
  exports: [BranchesService, WarehousesService, TypeOrmModule],
})
export class OrganizationModule {}
