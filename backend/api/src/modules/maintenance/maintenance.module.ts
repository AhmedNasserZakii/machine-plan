import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceModule } from 'src/modules/finance/finance.module';
import { MaintenanceLocation } from 'src/modules/lookups/entities/maintenance-location.entity';
import { MachinesModule } from 'src/modules/machines/machines.module';
import { MediaModule } from 'src/modules/media/media.module';
import { MerchantsModule } from 'src/modules/merchants/merchants.module';
import { Warehouse } from 'src/modules/organization/entities/warehouse.entity';
import { ReplacementsModule } from 'src/modules/replacements/replacements.module';
import { TransfersModule } from 'src/modules/transfers/transfers.module';
import { ViolationsModule } from 'src/modules/violations/violations.module';
import { MaintenanceOrder } from './entities/maintenance-order.entity';
import { MachineMaintenanceController } from './machine-maintenance.controller';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

/**
 * Sits downstream of everything a close flow touches: the transfer engine for the two legs, and
 * finance, violations and merchants for the three ways a repair turns into money (`11`, step 4).
 * Nothing imports this module back — the arrows all point one way on purpose.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MaintenanceOrder, MaintenanceLocation, Warehouse]),
    MachinesModule,
    TransfersModule,
    FinanceModule,
    ViolationsModule,
    MerchantsModule,
    ReplacementsModule,
    MediaModule,
  ],
  controllers: [MaintenanceController, MachineMaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService, TypeOrmModule],
})
export class MaintenanceModule {}
