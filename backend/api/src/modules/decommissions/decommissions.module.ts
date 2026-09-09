import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DecommissionReason } from 'src/modules/lookups/entities/decommission-reason.entity';
import { MachinesModule } from 'src/modules/machines/machines.module';
import { MaintenanceModule } from 'src/modules/maintenance/maintenance.module';
import { MediaModule } from 'src/modules/media/media.module';
import { Warehouse } from 'src/modules/organization/entities/warehouse.entity';
import { TransfersModule } from 'src/modules/transfers/transfers.module';
import { DecommissionsController } from './decommissions.controller';
import { DecommissionsService } from './decommissions.service';
import { Decommission } from './entities/decommission.entity';
import { MachineDecommissionController } from './machine-decommission.controller';

/**
 * The last module in the lifecycle, and the only one that imports maintenance: scrapping a machine
 * has to know whether it is still away being repaired (`13`, step 2).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Decommission, DecommissionReason, Warehouse]),
    MachinesModule,
    MaintenanceModule,
    TransfersModule,
    MediaModule,
  ],
  controllers: [DecommissionsController, MachineDecommissionController],
  providers: [DecommissionsService],
  exports: [DecommissionsService],
})
export class DecommissionsModule {}
