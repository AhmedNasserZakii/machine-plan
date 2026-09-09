import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DecommissionReason } from './entities/decommission-reason.entity';
import { DecommissionReasonTranslation } from './entities/decommission-reason-translation.entity';
import { MachineModel } from './entities/machine-model.entity';
import { MachineModelTranslation } from './entities/machine-model-translation.entity';
import { MachineType } from './entities/machine-type.entity';
import { MachineTypeTranslation } from './entities/machine-type-translation.entity';
import { MaintenanceLocation } from './entities/maintenance-location.entity';
import { MaintenanceLocationTranslation } from './entities/maintenance-location-translation.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { PaymentMethodTranslation } from './entities/payment-method-translation.entity';
import { ViolationType } from './entities/violation-type.entity';
import { ViolationTypeTranslation } from './entities/violation-type-translation.entity';
import { LookupsController } from './lookups.controller';
import { MachineCatalogueController } from './machine-catalogue.controller';
import { DecommissionReasonsService } from './services/decommission-reasons.service';
import { MachineModelsService } from './services/machine-models.service';
import { MachineTypesService } from './services/machine-types.service';
import { MaintenanceLocationsService } from './services/maintenance-locations.service';
import { PaymentMethodsService } from './services/payment-methods.service';
import { ViolationTypesService } from './services/violation-types.service';

const ENTITIES = [
  MachineType,
  MachineTypeTranslation,
  MachineModel,
  MachineModelTranslation,
  PaymentMethod,
  PaymentMethodTranslation,
  ViolationType,
  ViolationTypeTranslation,
  MaintenanceLocation,
  MaintenanceLocationTranslation,
  DecommissionReason,
  DecommissionReasonTranslation,
];

const SERVICES = [
  MachineTypesService,
  MachineModelsService,
  PaymentMethodsService,
  ViolationTypesService,
  MaintenanceLocationsService,
  DecommissionReasonsService,
];

/**
 * The seeded reference tables. Exported so feature modules can validate FKs against them
 * (a maintenance order checking its location, a transaction checking its payment method).
 */
@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  controllers: [MachineCatalogueController, LookupsController],
  providers: SERVICES,
  exports: [...SERVICES, TypeOrmModule],
})
export class LookupsModule {}
