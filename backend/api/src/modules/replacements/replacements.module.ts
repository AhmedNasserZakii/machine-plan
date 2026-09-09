import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MachineModel } from 'src/modules/lookups/entities/machine-model.entity';
import { MachinesModule } from 'src/modules/machines/machines.module';
import { Warehouse } from 'src/modules/organization/entities/warehouse.entity';
import { MachineReplacement } from './entities/machine-replacement.entity';
import { ReplacementsController } from './replacements.controller';
import { ReplacementsService } from './replacements.service';

/**
 * Depends on `MachinesModule` for the machine and battery repositories, and on nothing else. The
 * dependency runs one way on purpose: maintenance imports this module to conclude an order as a
 * swap, and importing maintenance back would close the cycle.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MachineReplacement, MachineModel, Warehouse]),
    MachinesModule,
  ],
  controllers: [ReplacementsController],
  providers: [ReplacementsService],
  exports: [ReplacementsService],
})
export class ReplacementsModule {}
