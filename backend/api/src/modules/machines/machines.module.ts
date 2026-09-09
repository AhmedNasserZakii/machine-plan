import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MachineModel } from 'src/modules/lookups/entities/machine-model.entity';
import { SettingsModule } from 'src/modules/settings/settings.module';
import { Battery } from './entities/battery.entity';
import { Machine } from './entities/machine.entity';
import { MachineInsightsService } from './machine-insights.service';
import { MachinesController } from './machines.controller';
import { MachinesService } from './machines.service';

/**
 * `MachineModel` is registered as a repository rather than by importing `LookupsModule`, which
 * keeps the two modules free of a cycle — the lookups module has no reason to know machines exist.
 *
 * `SettingsModule` supplies the decommission thresholds the cost summary and the candidates list
 * are judged against (`13`). It depends on nothing, so it cannot close a cycle either.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Machine, Battery, MachineModel]), SettingsModule],
  controllers: [MachinesController],
  providers: [MachinesService, MachineInsightsService],
  exports: [MachinesService, MachineInsightsService, TypeOrmModule],
})
export class MachinesModule {}
