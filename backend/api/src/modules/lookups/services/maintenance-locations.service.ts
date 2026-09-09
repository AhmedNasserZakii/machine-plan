import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenanceLocation } from '../entities/maintenance-location.entity';
import { MaintenanceLocationTranslation } from '../entities/maintenance-location-translation.entity';
import { LookupCrudService } from '../lookup-crud.service';

@Injectable()
export class MaintenanceLocationsService extends LookupCrudService<
  MaintenanceLocationTranslation,
  MaintenanceLocation
> {
  constructor(@InjectRepository(MaintenanceLocation) repository: Repository<MaintenanceLocation>) {
    super(repository, 'maintenance_location');
  }
}
