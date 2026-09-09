import { Entity, Index, OneToMany } from 'typeorm';
import { LookupEntity } from 'src/common/entities/lookup.entity';
import { MaintenanceLocationTranslation } from './maintenance-location-translation.entity';

/** Seeded: INTERNAL_WORKSHOP, FACTORY, SERVICE_CENTER (`03-database-schema.md` §G). */
@Entity('maintenance_locations')
@Index('uq_maintenance_locations_code', ['code'], { unique: true })
export class MaintenanceLocation extends LookupEntity {
  @OneToMany(
    () => MaintenanceLocationTranslation,
    (translation) => translation.maintenanceLocation,
    { cascade: ['insert', 'update'] },
  )
  translations: MaintenanceLocationTranslation[];
}
